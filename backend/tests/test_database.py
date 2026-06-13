import sqlite3

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

transport = ASGITransport(app=app)


def client():
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.fixture
def sample_db(tmp_path):
    ws = tmp_path / "default"
    ws.mkdir(parents=True, exist_ok=True)
    db = ws / "app.sqlite"
    conn = sqlite3.connect(db)
    conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, age INTEGER)")
    conn.executemany("INSERT INTO users (name, age) VALUES (?, ?)",
                     [("alice", 30), ("bob", 25), ("carol", 41)])
    conn.commit()
    conn.close()
    return "default/app.sqlite"


@pytest.mark.asyncio
async def test_list_databases(sample_db):
    async with client() as ac:
        r = await ac.get("/api/database/list", params={"workspace": "default"})
    assert r.status_code == 200
    paths = [d["path"] for d in r.json()["databases"]]
    assert sample_db in paths


@pytest.mark.asyncio
async def test_list_tables(sample_db):
    async with client() as ac:
        r = await ac.get("/api/database/tables", params={"db_path": sample_db})
    assert r.status_code == 200
    assert "users" in r.json()["tables"]


@pytest.mark.asyncio
async def test_schema_and_rows(sample_db):
    async with client() as ac:
        r = await ac.get("/api/database/schema", params={"db_path": sample_db, "table": "users"})
        assert r.status_code == 200
        cols = [c["name"] for c in r.json()["columns"]]
        assert {"id", "name", "age"} <= set(cols)
        assert r.json()["row_count"] == 3

        r2 = await ac.get("/api/database/rows", params={"db_path": sample_db, "table": "users", "limit": 2})
        assert r2.status_code == 200
        body = r2.json()
        assert body["total"] == 3
        assert len(body["rows"]) == 2


@pytest.mark.asyncio
async def test_rows_limit_offset_clamped(sample_db):
    async with client() as ac:
        r = await ac.get("/api/database/rows", params={
            "db_path": sample_db, "table": "users", "limit": -5, "offset": -10,
        })
    assert r.status_code == 200
    assert r.json()["limit"] >= 1
    assert r.json()["offset"] == 0


@pytest.mark.asyncio
async def test_schema_invalid_table(sample_db):
    async with client() as ac:
        r = await ac.get("/api/database/schema", params={"db_path": sample_db, "table": "users; DROP TABLE users"})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_query_read_only(sample_db):
    async with client() as ac:
        r = await ac.post("/api/database/query", json={
            "db_path": sample_db, "sql": "SELECT name FROM users ORDER BY age DESC LIMIT 1",
        })
    assert r.status_code == 200
    assert r.json()["rows"][0]["name"] == "carol"


@pytest.mark.asyncio
async def test_query_write_blocked_by_keyword(sample_db):
    async with client() as ac:
        for sql in ["DELETE FROM users", "DROP TABLE users", "UPDATE users SET age=0", "INSERT INTO users VALUES (9,'x',1)"]:
            r = await ac.post("/api/database/query", json={"db_path": sample_db, "sql": sql})
            assert r.status_code == 400, sql


@pytest.mark.asyncio
async def test_query_write_blocked_at_engine_level(sample_db):
    # Even a sneaky write that slips past the keyword check (e.g. via a CTE)
    # must fail because the connection is opened read-only.
    async with client() as ac:
        r = await ac.post("/api/database/query", json={
            "db_path": sample_db,
            "sql": "WITH x AS (SELECT 1) DELETE FROM users",
        })
    # Either blocked by keyword scan or by the read-only engine; never 200.
    assert r.status_code == 400
    # Confirm nothing was deleted.
    async with client() as ac:
        r2 = await ac.get("/api/database/schema", params={"db_path": sample_db, "table": "users"})
    assert r2.json()["row_count"] == 3


@pytest.mark.asyncio
async def test_database_traversal_blocked(sample_db):
    async with client() as ac:
        r = await ac.get("/api/database/tables", params={"db_path": "../../../etc/hosts"})
    assert r.status_code in (403, 404, 400)


@pytest.mark.asyncio
async def test_database_missing_404():
    async with client() as ac:
        r = await ac.get("/api/database/tables", params={"db_path": "default/nope.sqlite"})
    assert r.status_code == 404
