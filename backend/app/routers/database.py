import sqlite3
import os
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/api/database", tags=["database"])


def resolve_db(db_path: str) -> Path:
    base = settings.workspace_path.resolve()
    full = (base / db_path.lstrip("/")).resolve()
    if not str(full).startswith(str(base)):
        raise HTTPException(403, "Access denied")
    if not full.exists():
        raise HTTPException(404, f"Database not found: {db_path}")
    return full


def get_conn(db_path: str) -> sqlite3.Connection:
    full = resolve_db(db_path)
    conn = sqlite3.connect(str(full))
    conn.row_factory = sqlite3.Row
    return conn


@router.get("/list")
async def list_databases(workspace: str = "default"):
    base = settings.workspace_path / workspace
    dbs = []
    for root, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if d not in ("node_modules", "__pycache__", ".git", "venv")]
        for f in files:
            if f.endswith((".db", ".sqlite", ".sqlite3")):
                full = Path(root) / f
                dbs.append({"name": f, "path": str(full.relative_to(settings.workspace_path)), "size": full.stat().st_size})
    return {"databases": dbs}


@router.get("/tables")
async def list_tables(db_path: str):
    try:
        conn = get_conn(db_path)
        cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        tables = [row[0] for row in cur.fetchall()]
        conn.close()
        return {"tables": tables}
    except sqlite3.Error as e:
        raise HTTPException(400, str(e))


@router.get("/schema")
async def table_schema(db_path: str, table: str):
    try:
        conn = get_conn(db_path)
        cur = conn.execute(f"PRAGMA table_info({table})")
        cols = [dict(row) for row in cur.fetchall()]
        cur2 = conn.execute(f"PRAGMA index_list({table})")
        indexes = [dict(row) for row in cur2.fetchall()]
        cur3 = conn.execute(f"SELECT COUNT(*) as cnt FROM {table}")
        count = cur3.fetchone()[0]
        conn.close()
        return {"columns": cols, "indexes": indexes, "row_count": count}
    except sqlite3.Error as e:
        raise HTTPException(400, str(e))


@router.get("/rows")
async def get_rows(db_path: str, table: str, limit: int = 100, offset: int = 0):
    if limit > 1000:
        limit = 1000
    try:
        conn = get_conn(db_path)
        cur = conn.execute(f"SELECT * FROM {table} LIMIT ? OFFSET ?", (limit, offset))
        rows = [dict(row) for row in cur.fetchall()]
        cur2 = conn.execute(f"SELECT COUNT(*) FROM {table}")
        total = cur2.fetchone()[0]
        conn.close()
        return {"rows": rows, "total": total, "limit": limit, "offset": offset}
    except sqlite3.Error as e:
        raise HTTPException(400, str(e))


class QueryBody(BaseModel):
    db_path: str
    sql: str


@router.post("/query")
async def run_query(body: QueryBody):
    sql_upper = body.sql.strip().upper()
    BLOCKED = ("INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER", "TRUNCATE", "REPLACE")
    for kw in BLOCKED:
        if sql_upper.startswith(kw) or f" {kw} " in sql_upper:
            raise HTTPException(400, f"Write operation '{kw}' not allowed in query viewer")
    try:
        conn = get_conn(body.db_path)
        cur = conn.execute(body.sql)
        if cur.description:
            cols = [d[0] for d in cur.description]
            rows = [dict(zip(cols, row)) for row in cur.fetchmany(500)]
        else:
            cols, rows = [], []
        conn.close()
        return {"columns": cols, "rows": rows, "count": len(rows)}
    except sqlite3.Error as e:
        raise HTTPException(400, str(e))
