"""Read-only inspection across all supported engines.

Given a ``project_databases`` metadata row, expose a uniform shape to the
viewer: list "tables" (collections, for Mongo), describe a table's schema,
page through rows, and run a read-only query. Drivers are imported lazily.
"""
from __future__ import annotations

import re
import sqlite3

from fastapi import HTTPException

from app import provisioning
from app.security import safe_join

_WRITE_KEYWORDS = frozenset({
    "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER", "TRUNCATE",
    "REPLACE", "ATTACH", "DETACH", "PRAGMA", "VACUUM", "REINDEX", "BEGIN",
    "COMMIT", "ROLLBACK", "SAVEPOINT", "RELEASE", "GRANT", "REVOKE",
    "MERGE", "CALL", "SET", "USE", "LOAD", "COPY",
})


def _assert_read_only(sql: str) -> None:
    first = re.match(r"\s*([A-Za-z]+)", sql)
    keyword = first.group(1).upper() if first else ""
    if keyword in _WRITE_KEYWORDS:
        raise HTTPException(400, f"Only read-only queries are allowed (got '{keyword}')")
    if ";" in sql.strip().rstrip(";"):
        raise HTTPException(400, "Only a single statement is allowed")


def _valid_name(name: str) -> str:
    if not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", name):
        raise HTTPException(400, f"Invalid table/collection name: {name!r}")
    return name


# --------------------------------------------------------------------------
# Dispatch
# --------------------------------------------------------------------------
def list_tables(db: dict) -> dict:
    return _DISPATCH[db["engine"]]["tables"](db)


def table_schema(db: dict, table: str) -> dict:
    return _DISPATCH[db["engine"]]["schema"](db, table)


def get_rows(db: dict, table: str, limit: int, offset: int) -> dict:
    limit = max(1, min(limit, 1000))
    offset = max(0, offset)
    return _DISPATCH[db["engine"]]["rows"](db, table, limit, offset)


def run_query(db: dict, sql: str) -> dict:
    if not sql.strip():
        raise HTTPException(400, "Empty query")
    return _DISPATCH[db["engine"]]["query"](db, sql)


# --------------------------------------------------------------------------
# SQLite
# --------------------------------------------------------------------------
def _sqlite_conn(db: dict) -> sqlite3.Connection:
    path = safe_join(db["db_name"])
    if not path.exists():
        raise HTTPException(404, "Database file not found")
    conn = sqlite3.connect(f"{path.as_uri()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def _sqlite_tables(db: dict) -> dict:
    conn = _sqlite_conn(db)
    try:
        cur = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' "
            "AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
        return {"tables": [r[0] for r in cur.fetchall()]}
    finally:
        conn.close()


def _sqlite_schema(db: dict, table: str) -> dict:
    table = _valid_name(table)
    conn = _sqlite_conn(db)
    try:
        cols = [dict(r) for r in conn.execute(f'PRAGMA table_info("{table}")')]
        if not cols:
            raise HTTPException(404, f"Table not found: {table}")
        count = conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
        return {
            "columns": [
                {"name": c["name"], "type": c["type"], "pk": bool(c["pk"]),
                 "notnull": bool(c["notnull"])}
                for c in cols
            ],
            "row_count": count,
        }
    finally:
        conn.close()


def _sqlite_rows(db: dict, table: str, limit: int, offset: int) -> dict:
    table = _valid_name(table)
    conn = _sqlite_conn(db)
    try:
        cur = conn.execute(f'SELECT * FROM "{table}" LIMIT ? OFFSET ?', (limit, offset))
        cols = [d[0] for d in cur.description]
        rows = [dict(r) for r in cur.fetchall()]
        total = conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
        return {"columns": cols, "rows": rows, "total": total, "limit": limit, "offset": offset}
    finally:
        conn.close()


def _sqlite_query(db: dict, sql: str) -> dict:
    _assert_read_only(sql)
    conn = _sqlite_conn(db)
    try:
        cur = conn.execute(sql)
        if cur.description:
            cols = [d[0] for d in cur.description]
            rows = [dict(zip(cols, r, strict=False)) for r in cur.fetchmany(500)]
        else:
            cols, rows = [], []
        return {"columns": cols, "rows": rows, "count": len(rows)}
    except sqlite3.Error as e:
        raise HTTPException(400, str(e)) from e
    finally:
        conn.close()


# --------------------------------------------------------------------------
# Postgres / MySQL (shared SQL path via DB-API)
# --------------------------------------------------------------------------
def _sql_conn(db: dict):
    engine = db["engine"]
    if engine == "postgres":
        import psycopg2
        from psycopg2.extras import RealDictCursor
        return psycopg2.connect(
            host=provisioning.POSTGRES.host, port=provisioning.POSTGRES.port,
            user=db["db_user"], password=db["db_password"], dbname=db["db_name"],
            cursor_factory=RealDictCursor, connect_timeout=5,
        ), "postgres"
    import pymysql
    from pymysql.cursors import DictCursor
    return pymysql.connect(
        host=provisioning.MYSQL.host, port=provisioning.MYSQL.port,
        user=db["db_user"], password=db["db_password"], database=db["db_name"],
        cursorclass=DictCursor, connect_timeout=5, read_default_file="",
    ), "mysql"


def _sql_tables(db: dict) -> dict:
    conn, kind = _sql_conn(db)
    try:
        cur = conn.cursor()
        if kind == "postgres":
            cur.execute(
                "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
            )
        else:
            cur.execute(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema=%s ORDER BY table_name",
                (db["db_name"],),
            )
        rows = cur.fetchall()
        tables = [list(r.values())[0] for r in rows]
        return {"tables": tables}
    finally:
        conn.close()


def _sql_schema(db: dict, table: str) -> dict:
    table = _valid_name(table)
    conn, kind = _sql_conn(db)
    try:
        cur = conn.cursor()
        schema_filter = "public" if kind == "postgres" else db["db_name"]
        cur.execute(
            "SELECT column_name, data_type, is_nullable "
            "FROM information_schema.columns "
            "WHERE table_name=%s AND table_schema=%s ORDER BY ordinal_position",
            (table, schema_filter),
        )
        cols = cur.fetchall()
        if not cols:
            raise HTTPException(404, f"Table not found: {table}")
        cur.execute(f'SELECT COUNT(*) AS c FROM "{table}"' if kind == "postgres"
                    else f"SELECT COUNT(*) AS c FROM `{table}`")
        count = list(cur.fetchone().values())[0]
        return {
            "columns": [
                {"name": c["column_name"], "type": c["data_type"],
                 "notnull": c["is_nullable"] == "NO", "pk": False}
                for c in cols
            ],
            "row_count": count,
        }
    finally:
        conn.close()


def _sql_rows(db: dict, table: str, limit: int, offset: int) -> dict:
    table = _valid_name(table)
    conn, kind = _sql_conn(db)
    try:
        cur = conn.cursor()
        q = (f'SELECT * FROM "{table}" LIMIT %s OFFSET %s' if kind == "postgres"
             else f"SELECT * FROM `{table}` LIMIT %s OFFSET %s")
        cur.execute(q, (limit, offset))
        rows = [dict(r) for r in cur.fetchall()]
        cols = list(rows[0].keys()) if rows else []
        cur.execute(f'SELECT COUNT(*) AS c FROM "{table}"' if kind == "postgres"
                    else f"SELECT COUNT(*) AS c FROM `{table}`")
        total = list(cur.fetchone().values())[0]
        return {"columns": cols, "rows": _jsonable(rows), "total": total,
                "limit": limit, "offset": offset}
    finally:
        conn.close()


def _sql_query(db: dict, sql: str) -> dict:
    _assert_read_only(sql)
    conn, _ = _sql_conn(db)
    try:
        cur = conn.cursor()
        cur.execute(sql)
        if cur.description:
            rows = [dict(r) for r in cur.fetchmany(500)]
            cols = list(rows[0].keys()) if rows else [d[0] for d in cur.description]
        else:
            cols, rows = [], []
        return {"columns": cols, "rows": _jsonable(rows), "count": len(rows)}
    except Exception as e:  # driver-specific errors -> 400
        raise HTTPException(400, str(e)) from e
    finally:
        conn.close()


# --------------------------------------------------------------------------
# MongoDB
# --------------------------------------------------------------------------
def _mongo_db(db: dict):
    from pymongo import MongoClient
    client = MongoClient(
        host=provisioning.MONGO.host, port=provisioning.MONGO.port,
        username=db["db_user"], password=db["db_password"],
        authSource=db["db_name"], serverSelectionTimeoutMS=5000,
    )
    return client, client[db["db_name"]]


def _mongo_tables(db: dict) -> dict:
    client, mdb = _mongo_db(db)
    try:
        cols = [c for c in mdb.list_collection_names() if not c.startswith("_ide")]
        return {"tables": sorted(cols)}
    finally:
        client.close()


def _mongo_schema(db: dict, table: str) -> dict:
    table = _valid_name(table)
    client, mdb = _mongo_db(db)
    try:
        keys: dict[str, str] = {}
        for doc in mdb[table].find().limit(50):
            for k, v in doc.items():
                keys.setdefault(k, type(v).__name__)
        count = mdb[table].estimated_document_count()
        return {
            "columns": [{"name": k, "type": t, "pk": k == "_id", "notnull": False}
                        for k, t in keys.items()],
            "row_count": count,
        }
    finally:
        client.close()


def _mongo_rows(db: dict, table: str, limit: int, offset: int) -> dict:
    table = _valid_name(table)
    client, mdb = _mongo_db(db)
    try:
        docs = list(mdb[table].find().skip(offset).limit(limit))
        cols: list[str] = []
        for d in docs:
            for k in d:
                if k not in cols:
                    cols.append(k)
        total = mdb[table].count_documents({})
        return {"columns": cols, "rows": _jsonable(docs), "total": total,
                "limit": limit, "offset": offset}
    finally:
        client.close()


def _mongo_query(db: dict, sql: str) -> dict:
    """For Mongo the "query" is a JSON document: {"collection": ..., "filter": {...}}."""
    import json
    try:
        spec = json.loads(sql)
        collection = _valid_name(spec["collection"])
        filt = spec.get("filter", {})
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        raise HTTPException(
            400,
            'Mongo query must be JSON like {"collection":"users","filter":{}}',
        ) from e
    client, mdb = _mongo_db(db)
    try:
        docs = list(mdb[collection].find(filt).limit(500))
        cols: list[str] = []
        for d in docs:
            for k in d:
                if k not in cols:
                    cols.append(k)
        return {"columns": cols, "rows": _jsonable(docs), "count": len(docs)}
    finally:
        client.close()


def _jsonable(rows: list[dict]) -> list[dict]:
    """Coerce driver-native types (datetime, Decimal, ObjectId, bytes) to str."""
    out = []
    for row in rows:
        clean = {}
        for k, v in row.items():
            if isinstance(v, (str, int, float, bool)) or v is None:
                clean[k] = v
            else:
                clean[k] = str(v)
        out.append(clean)
    return out


_DISPATCH = {
    "sqlite": {"tables": _sqlite_tables, "schema": _sqlite_schema,
               "rows": _sqlite_rows, "query": _sqlite_query},
    "postgres": {"tables": _sql_tables, "schema": _sql_schema,
                 "rows": _sql_rows, "query": _sql_query},
    "mysql": {"tables": _sql_tables, "schema": _sql_schema,
              "rows": _sql_rows, "query": _sql_query},
    "mongodb": {"tables": _mongo_tables, "schema": _mongo_schema,
                "rows": _mongo_rows, "query": _mongo_query},
}
