import os
import re
import sqlite3
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import db_inspect, metadata, provisioning
from app.auth import CurrentUser
from app.security import SKIP_DIRS, safe_join, safe_workspace, workspace_root

router = APIRouter(prefix="/api/database", tags=["database"])

_WRITE_KEYWORDS = frozenset({
    "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER", "TRUNCATE",
    "REPLACE", "ATTACH", "DETACH", "PRAGMA", "VACUUM", "REINDEX", "BEGIN",
    "COMMIT", "ROLLBACK", "SAVEPOINT", "RELEASE", "GRANT", "ANALYZE",
})


def validate_table_name(name: str) -> str:
    """Allow only safe SQLite identifier characters."""
    if not re.match(r'^[A-Za-z_][A-Za-z0-9_]*$', name):
        raise HTTPException(400, f"Invalid table name: {name!r}")
    return name


def resolve_db(db_path: str) -> Path:
    full = safe_join(db_path)
    if not full.exists():
        raise HTTPException(404, f"Database not found: {db_path}")
    if not full.is_file():
        raise HTTPException(400, "Not a file")
    return full


def get_conn(db_path: str, read_only: bool = False) -> sqlite3.Connection:
    full = resolve_db(db_path)
    if read_only:
        conn = sqlite3.connect(f"{full.as_uri()}?mode=ro", uri=True)
    else:
        conn = sqlite3.connect(str(full))
    conn.row_factory = sqlite3.Row
    return conn


@router.get("/list")
async def list_databases(workspace: str = "default"):
    ws = safe_workspace(workspace)
    base = workspace_root() / ws
    dbs = []
    for root, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in SKIP_DIRS]
        for f in files:
            if f.endswith((".db", ".sqlite", ".sqlite3")):
                full = Path(root) / f
                try:
                    size = full.stat().st_size
                except OSError:
                    continue
                dbs.append({
                    "name": f,
                    "path": str(full.relative_to(workspace_root())),
                    "size": size,
                })
    return {"databases": dbs}


@router.get("/tables")
async def list_tables(db_path: str):
    conn = None
    try:
        conn = get_conn(db_path, read_only=True)
        cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        tables = [row[0] for row in cur.fetchall()]
        return {"tables": tables}
    except sqlite3.Error as e:
        raise HTTPException(400, str(e)) from e
    finally:
        if conn:
            conn.close()


@router.get("/schema")
async def table_schema(db_path: str, table: str):
    table = validate_table_name(table)
    conn = None
    try:
        conn = get_conn(db_path, read_only=True)
        cur = conn.execute(f"PRAGMA table_info(\"{table}\")")
        cols = [dict(row) for row in cur.fetchall()]
        if not cols:
            raise HTTPException(404, f"Table not found: {table}")
        cur2 = conn.execute(f"PRAGMA index_list(\"{table}\")")
        indexes = [dict(row) for row in cur2.fetchall()]
        cur3 = conn.execute(f"SELECT COUNT(*) as cnt FROM \"{table}\"")
        count = cur3.fetchone()[0]
        return {"columns": cols, "indexes": indexes, "row_count": count}
    except sqlite3.Error as e:
        raise HTTPException(400, str(e)) from e
    finally:
        if conn:
            conn.close()


@router.get("/rows")
async def get_rows(db_path: str, table: str, limit: int = 100, offset: int = 0):
    table = validate_table_name(table)
    limit = max(1, min(limit, 1000))
    offset = max(0, offset)
    conn = None
    try:
        conn = get_conn(db_path, read_only=True)
        cur = conn.execute(f"SELECT * FROM \"{table}\" LIMIT ? OFFSET ?", (limit, offset))
        rows = [dict(row) for row in cur.fetchall()]
        cur2 = conn.execute(f"SELECT COUNT(*) FROM \"{table}\"")
        total = cur2.fetchone()[0]
        return {"rows": rows, "total": total, "limit": limit, "offset": offset}
    except sqlite3.Error as e:
        raise HTTPException(400, str(e)) from e
    finally:
        if conn:
            conn.close()


class QueryBody(BaseModel):
    db_path: str
    sql: str


@router.post("/query")
async def run_query(body: QueryBody):
    sql = body.sql.strip()
    if not sql:
        raise HTTPException(400, "Empty query")
    # The connection below is opened read-only, so writes are impossible at the
    # engine level. This check just returns a clearer message than a SQLite error.
    first = re.match(r'\s*([A-Za-z]+)', sql)
    keyword = first.group(1).upper() if first else ""
    if keyword in _WRITE_KEYWORDS:
        raise HTTPException(400, f"Only read-only queries are allowed (got '{keyword}')")
    conn = None
    try:
        conn = get_conn(body.db_path, read_only=True)
        cur = conn.execute(body.sql)
        if cur.description:
            cols = [d[0] for d in cur.description]
            rows = [dict(zip(cols, row, strict=False)) for row in cur.fetchmany(500)]
        else:
            cols, rows = [], []
        return {"columns": cols, "rows": rows, "count": len(rows)}
    except sqlite3.Error as e:
        raise HTTPException(400, str(e)) from e
    finally:
        if conn:
            conn.close()


# ==========================================================================
# Engine-aware, project-scoped endpoints.
#
# The routes above browse raw *.sqlite files in a workspace (handy, no auth).
# The routes below operate on a *provisioned* database (by its metadata id),
# so they work uniformly across SQLite / Postgres / MySQL / MongoDB and are
# scoped to the authenticated owner.
# ==========================================================================
def _owned_db(db_id: int, user: dict) -> dict:
    db = metadata.get_database(db_id)
    if not db:
        raise HTTPException(404, "Database not found")
    project = metadata.get_project(db["project_id"])
    if not project or project["user_id"] != user["id"]:
        raise HTTPException(404, "Database not found")
    metadata.touch_database(db_id)
    return db


@router.get("/engine/{db_id}/info")
async def engine_info(db_id: int, user: dict = CurrentUser):
    db = _owned_db(db_id, user)
    project = metadata.get_project(db["project_id"])
    return {
        "id": db["id"], "engine": db["engine"], "status": db["status"],
        "connection": provisioning.connection_info(db, project),
    }


@router.get("/engine/{db_id}/tables")
async def engine_tables(db_id: int, user: dict = CurrentUser):
    return db_inspect.list_tables(_owned_db(db_id, user))


@router.get("/engine/{db_id}/schema")
async def engine_schema(db_id: int, table: str, user: dict = CurrentUser):
    return db_inspect.table_schema(_owned_db(db_id, user), table)


@router.get("/engine/{db_id}/rows")
async def engine_rows(
    db_id: int, table: str, limit: int = 100, offset: int = 0, user: dict = CurrentUser
):
    return db_inspect.get_rows(_owned_db(db_id, user), table, limit, offset)


class EngineQuery(BaseModel):
    sql: str


@router.post("/engine/{db_id}/query")
async def engine_query(db_id: int, body: EngineQuery, user: dict = CurrentUser):
    return db_inspect.run_query(_owned_db(db_id, user), body.sql)
