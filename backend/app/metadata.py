"""Application metadata store (users, projects, per-project databases).

A single SQLite file that lives outside any user workspace and holds only the
bookkeeping the IDE needs: which user owns which project, and which logical
database was provisioned for it. User application data does not live here; it
lives in the database provisioned for each project (see ``provisioning.py``).
"""
from __future__ import annotations

import secrets
import sqlite3
import time

from app.security import workspace_root

# The control-plane DB lives in a hidden directory that is a *sibling* of the
# user workspaces, so it can never appear in a workspace file tree and a user
# can never name a workspace that collides with it.
_META_DIR = workspace_root() / ".cloud_ide"
_META_PATH = _META_DIR / "metadata.db"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,            -- short uuid, also used in db names
    user_id     INTEGER NOT NULL,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL,               -- workspace directory name segment
    created_at  REAL NOT NULL,
    UNIQUE(user_id, slug),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_databases (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  TEXT NOT NULL,
    engine      TEXT NOT NULL,               -- sqlite | postgres | mysql | mongodb
    db_name     TEXT NOT NULL,               -- logical db / schema / sqlite file rel-path
    db_user     TEXT,                         -- per-tenant role (server engines)
    db_password TEXT,                         -- generated, scoped to db_name only
    status      TEXT NOT NULL DEFAULT 'pending',  -- pending | ready | error
    last_used   REAL NOT NULL,
    created_at  REAL NOT NULL,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_pdb_project ON project_databases(project_id);
"""


def _connect() -> sqlite3.Connection:
    _META_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(_META_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.executescript(_SCHEMA)


# --------------------------------------------------------------------------
# Users
# --------------------------------------------------------------------------
def create_user(email: str, password_hash: str) -> dict:
    now = time.time()
    with _connect() as conn:
        cur = conn.execute(
            "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
            (email, password_hash, now),
        )
        return {"id": cur.lastrowid, "email": email, "created_at": now}


def get_user_by_email(email: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: int) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None


# --------------------------------------------------------------------------
# Projects
# --------------------------------------------------------------------------
def _new_project_id() -> str:
    return secrets.token_hex(4)  # 8 hex chars, e.g. "9f3a1c2b"


def workspace_name(user_id: int, slug: str) -> str:
    """Workspace directory segment for a project.

    Encodes the owning user so every existing file/terminal/process/git router
    (which all take a single ``workspace`` path segment) becomes per-user with
    zero changes. Always a single valid segment, e.g. ``u7_todo-api``.
    """
    return f"u{user_id}_{slug}"


def create_project(user_id: int, name: str, slug: str) -> dict:
    now = time.time()
    pid = _new_project_id()
    with _connect() as conn:
        conn.execute(
            "INSERT INTO projects (id, user_id, name, slug, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (pid, user_id, name, slug, now),
        )
    return {
        "id": pid,
        "user_id": user_id,
        "name": name,
        "slug": slug,
        "workspace": workspace_name(user_id, slug),
        "created_at": now,
    }


def list_projects(user_id: int) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["workspace"] = workspace_name(d["user_id"], d["slug"])
        out.append(d)
    return out


def get_project(project_id: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not row:
        return None
    d = dict(row)
    d["workspace"] = workspace_name(d["user_id"], d["slug"])
    return d


def delete_project(project_id: str) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))


# --------------------------------------------------------------------------
# Project databases
# --------------------------------------------------------------------------
def record_database(
    project_id: str,
    engine: str,
    db_name: str,
    db_user: str | None,
    db_password: str | None,
    status: str = "ready",
) -> dict:
    now = time.time()
    with _connect() as conn:
        cur = conn.execute(
            "INSERT INTO project_databases "
            "(project_id, engine, db_name, db_user, db_password, status, last_used, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (project_id, engine, db_name, db_user, db_password, status, now, now),
        )
        rowid = cur.lastrowid
    return get_database(rowid)


def get_database(db_id: int) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM project_databases WHERE id = ?", (db_id,)
        ).fetchone()
        return dict(row) if row else None


def list_databases_for_project(project_id: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM project_databases WHERE project_id = ? ORDER BY created_at",
            (project_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def find_database(project_id: str, engine: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM project_databases WHERE project_id = ? AND engine = ?",
            (project_id, engine),
        ).fetchone()
        return dict(row) if row else None


def touch_database(db_id: int) -> None:
    with _connect() as conn:
        conn.execute(
            "UPDATE project_databases SET last_used = ? WHERE id = ?",
            (time.time(), db_id),
        )


def count_user_databases(user_id: int) -> int:
    with _connect() as conn:
        row = conn.execute(
            "SELECT COUNT(*) FROM project_databases pd "
            "JOIN projects p ON p.id = pd.project_id WHERE p.user_id = ?",
            (user_id,),
        ).fetchone()
        return row[0]
