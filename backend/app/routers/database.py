import os
import re
import sqlite3
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

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
        raise HTTPException(400, str(e))
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
        raise HTTPException(400, str(e))
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
        raise HTTPException(400, str(e))
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
    if first and first.group(1).upper() in _WRITE_KEYWORDS:
        raise HTTPException(400, f"Only read-only queries are allowed (got '{first.group(1).upper()}')")
    conn = None
    try:
        conn = get_conn(body.db_path, read_only=True)
        cur = conn.execute(body.sql)
        if cur.description:
            cols = [d[0] for d in cur.description]
            rows = [dict(zip(cols, row)) for row in cur.fetchmany(500)]
        else:
            cols, rows = [], []
        return {"columns": cols, "rows": rows, "count": len(rows)}
    except sqlite3.Error as e:
        raise HTTPException(400, str(e))
    finally:
        if conn:
            conn.close()
