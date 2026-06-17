"""Multi-tenant database provisioning.

The IDE shares a small, fixed pool of database servers (one Postgres, one MySQL,
one Mongo) across all users instead of running a server per user or per project.
For each project it creates a single logical database named ``proj_<projectid>``
on first use, with a dedicated role and a generated password scoped to that
database only. SQLite projects use a plain file in the project workspace.

This module is the single place that creates and destroys those logical
databases. The drivers (psycopg2 / pymysql / pymongo) are imported lazily so a
SQLite-only deployment needs none of them installed.
"""
from __future__ import annotations

import os
import re
import secrets
import sqlite3
from dataclasses import dataclass

from fastapi import HTTPException

from app import metadata
from app.security import safe_join

SUPPORTED_ENGINES = ("sqlite", "postgres", "mysql", "mongodb")
MAX_DATABASES_PER_USER = int(os.environ.get("MAX_DATABASES_PER_USER", "20"))


@dataclass
class ServerConfig:
    """Connection details for one *shared* database server (the admin role)."""

    host: str
    port: int
    admin_user: str
    admin_password: str

    @property
    def configured(self) -> bool:
        return bool(self.host)


# The shared servers. Hosts default to the docker-compose service names so the
# whole thing works out of the box under ``docker compose up``. If a host env
# var is empty, that engine is simply reported as unavailable instead of error.
POSTGRES = ServerConfig(
    host=os.environ.get("PG_HOST", "postgres"),
    port=int(os.environ.get("PG_PORT", "5432")),
    admin_user=os.environ.get("PG_ADMIN_USER", "ide_admin"),
    admin_password=os.environ.get("PG_ADMIN_PASSWORD", "ide_admin_pw"),
)
MYSQL = ServerConfig(
    host=os.environ.get("MYSQL_HOST", "mysql"),
    port=int(os.environ.get("MYSQL_PORT", "3306")),
    admin_user=os.environ.get("MYSQL_ADMIN_USER", "ide_admin"),
    admin_password=os.environ.get("MYSQL_ADMIN_PASSWORD", "ide_admin_pw"),
)
MONGO = ServerConfig(
    host=os.environ.get("MONGO_HOST", "mongo"),
    port=int(os.environ.get("MONGO_PORT", "27017")),
    admin_user=os.environ.get("MONGO_ADMIN_USER", "ide_admin"),
    admin_password=os.environ.get("MONGO_ADMIN_PASSWORD", "ide_admin_pw"),
)


def _ident(name: str) -> str:
    """Sanitise a value used in an identifier (db name / role)."""
    if not re.match(r"^[A-Za-z0-9_]+$", name):
        raise HTTPException(400, f"Unsafe identifier: {name!r}")
    return name


def engine_available(engine: str) -> bool:
    if engine == "sqlite":
        return True
    cfg = {"postgres": POSTGRES, "mysql": MYSQL, "mongodb": MONGO}.get(engine)
    return bool(cfg and cfg.configured)


# --------------------------------------------------------------------------
# Public API
# --------------------------------------------------------------------------
def provision(project: dict, engine: str) -> dict:
    """Lazily provision a logical database for ``project`` on ``engine``.

    Idempotent: if one already exists it is returned as-is. Enforces the
    per-user quota. Returns the ``project_databases`` metadata row.
    """
    engine = engine.lower()
    if engine not in SUPPORTED_ENGINES:
        raise HTTPException(400, f"Unsupported engine: {engine}")

    existing = metadata.find_database(project["id"], engine)
    if existing:
        return existing

    if metadata.count_user_databases(project["user_id"]) >= MAX_DATABASES_PER_USER:
        raise HTTPException(
            429,
            f"Database quota reached ({MAX_DATABASES_PER_USER} per user). "
            "Delete an unused database first.",
        )

    if engine != "sqlite" and not engine_available(engine):
        raise HTTPException(
            503,
            f"The shared {engine} server is not configured for this deployment.",
        )

    # Deterministic, collision-free names derived from the (unique) project id.
    db_name = f"proj_{project['id']}"
    db_user = f"u_{project['id']}"
    db_password = secrets.token_urlsafe(18)

    if engine == "sqlite":
        return _provision_sqlite(project)
    if engine == "postgres":
        _provision_postgres(db_name, db_user, db_password)
    elif engine == "mysql":
        _provision_mysql(db_name, db_user, db_password)
    elif engine == "mongodb":
        _provision_mongo(db_name, db_user, db_password)

    return metadata.record_database(
        project["id"], engine, db_name, db_user, db_password, status="ready"
    )


def connection_info(db_row: dict, project: dict) -> dict:
    """Return everything the user's app needs to connect to its database.

    Surfaced to the IDE so the user can copy a DATABASE_URL into their code.
    """
    engine = db_row["engine"]
    if engine == "sqlite":
        return {
            "engine": "sqlite",
            "url": f"sqlite:///{db_row['db_name'].split('/')[-1]}",
            "path": db_row["db_name"],
        }
    cfg = {"postgres": POSTGRES, "mysql": MYSQL, "mongodb": MONGO}[engine]
    user, pw, name = db_row["db_user"], db_row["db_password"], db_row["db_name"]
    if engine == "postgres":
        url = f"postgresql://{user}:{pw}@{cfg.host}:{cfg.port}/{name}"
    elif engine == "mysql":
        url = f"mysql://{user}:{pw}@{cfg.host}:{cfg.port}/{name}"
    else:
        url = f"mongodb://{user}:{pw}@{cfg.host}:{cfg.port}/{name}"
    return {
        "engine": engine,
        "url": url,
        "host": cfg.host,
        "port": cfg.port,
        "database": name,
        "user": user,
    }


# --------------------------------------------------------------------------
# Per-engine provisioning. Each creates ONE logical db + a scoped role on the
# corresponding SHARED server.
# --------------------------------------------------------------------------
def _provision_sqlite(project: dict) -> dict:
    """A SQLite "database" is just a file in the project's own workspace."""
    rel = f"{project['workspace']}/app.db"
    path = safe_join(rel)
    path.parent.mkdir(parents=True, exist_ok=True)
    # Touch the file so the viewer immediately sees a real (empty) database.
    sqlite3.connect(str(path)).close()
    return metadata.record_database(
        project["id"], "sqlite", rel, None, None, status="ready"
    )


def _provision_postgres(db_name: str, db_user: str, db_password: str) -> None:
    import psycopg2  # lazy
    from psycopg2 import sql

    db_name, db_user = _ident(db_name), _ident(db_user)
    conn = psycopg2.connect(
        host=POSTGRES.host, port=POSTGRES.port,
        user=POSTGRES.admin_user, password=POSTGRES.admin_password,
        dbname="postgres",
    )
    try:
        conn.autocommit = True  # CREATE DATABASE can't run in a transaction
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM pg_roles WHERE rolname = %s", (db_user,)
            )
            if not cur.fetchone():
                cur.execute(
                    sql.SQL("CREATE ROLE {} LOGIN PASSWORD %s").format(
                        sql.Identifier(db_user)
                    ),
                    (db_password,),
                )
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
            if not cur.fetchone():
                cur.execute(
                    sql.SQL("CREATE DATABASE {} OWNER {}").format(
                        sql.Identifier(db_name), sql.Identifier(db_user)
                    )
                )
            # Lock the tenant out of every other database on the shared server.
            cur.execute(
                sql.SQL("REVOKE ALL ON DATABASE {} FROM PUBLIC").format(
                    sql.Identifier(db_name)
                )
            )
            cur.execute(
                sql.SQL("GRANT ALL PRIVILEGES ON DATABASE {} TO {}").format(
                    sql.Identifier(db_name), sql.Identifier(db_user)
                )
            )
    finally:
        conn.close()


def _provision_mysql(db_name: str, db_user: str, db_password: str) -> None:
    import pymysql  # lazy

    db_name, db_user = _ident(db_name), _ident(db_user)
    conn = pymysql.connect(
        host=MYSQL.host, port=MYSQL.port,
        user=MYSQL.admin_user, password=MYSQL.admin_password,
        autocommit=True,
    )
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"CREATE DATABASE IF NOT EXISTS `{db_name}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
            cur.execute(
                "CREATE USER IF NOT EXISTS %s@'%%' IDENTIFIED BY %s",
                (db_user, db_password),
            )
            # Grants are scoped to this database only -> tenant isolation.
            cur.execute(f"GRANT ALL PRIVILEGES ON `{db_name}`.* TO %s@'%%'", (db_user,))
            cur.execute("FLUSH PRIVILEGES")
    finally:
        conn.close()


def _provision_mongo(db_name: str, db_user: str, db_password: str) -> None:
    from pymongo import MongoClient  # lazy

    db_name, db_user = _ident(db_name), _ident(db_user)
    client = MongoClient(
        host=MONGO.host, port=MONGO.port,
        username=MONGO.admin_user, password=MONGO.admin_password,
        serverSelectionTimeoutMS=5000,
    )
    try:
        db = client[db_name]
        # A Mongo database only materialises once it has data; create a scoped
        # user (readWrite on this db only) and a marker collection.
        db.command(
            "createUser", db_user, pwd=db_password,
            roles=[{"role": "readWrite", "db": db_name}],
        )
        db["_ide_marker"].insert_one({"created_by": "cloud-ide"})
    finally:
        client.close()


def deprovision(db_row: dict) -> None:
    """Drop a logical database (used when a project is deleted)."""
    engine = db_row["engine"]
    try:
        if engine == "sqlite":
            p = safe_join(db_row["db_name"])
            if p.exists():
                p.unlink()
        elif engine == "postgres":
            _drop_postgres(db_row["db_name"], db_row["db_user"])
        elif engine == "mysql":
            _drop_mysql(db_row["db_name"], db_row["db_user"])
        elif engine == "mongodb":
            _drop_mongo(db_row["db_name"])
    except Exception:  # best-effort cleanup; never block project deletion
        pass


def _drop_postgres(db_name: str, db_user: str) -> None:
    import psycopg2
    from psycopg2 import sql

    conn = psycopg2.connect(
        host=POSTGRES.host, port=POSTGRES.port,
        user=POSTGRES.admin_user, password=POSTGRES.admin_password, dbname="postgres",
    )
    try:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(
                sql.SQL("DROP DATABASE IF EXISTS {}").format(sql.Identifier(_ident(db_name)))
            )
            if db_user:
                cur.execute(
                    sql.SQL("DROP ROLE IF EXISTS {}").format(sql.Identifier(_ident(db_user)))
                )
    finally:
        conn.close()


def _drop_mysql(db_name: str, db_user: str) -> None:
    import pymysql

    conn = pymysql.connect(
        host=MYSQL.host, port=MYSQL.port,
        user=MYSQL.admin_user, password=MYSQL.admin_password, autocommit=True,
    )
    try:
        with conn.cursor() as cur:
            cur.execute(f"DROP DATABASE IF EXISTS `{_ident(db_name)}`")
            if db_user:
                cur.execute("DROP USER IF EXISTS %s@'%%'", (db_user,))
    finally:
        conn.close()


def _drop_mongo(db_name: str) -> None:
    from pymongo import MongoClient

    client = MongoClient(
        host=MONGO.host, port=MONGO.port,
        username=MONGO.admin_user, password=MONGO.admin_password,
        serverSelectionTimeoutMS=5000,
    )
    try:
        client.drop_database(_ident(db_name))
    finally:
        client.close()
