import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_write_and_read():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Write
        r = await ac.post("/api/files/write", json={
            "path": "default/hello.py",
            "content": "print('hello')",
        })
        assert r.status_code == 200

        # Read
        r = await ac.get("/api/files/read", params={"path": "default/hello.py"})
        assert r.status_code == 200
        assert r.json()["content"] == "print('hello')"


@pytest.mark.asyncio
async def test_delete_file():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post("/api/files/write", json={"path": "default/todelete.txt", "content": "x"})
        r = await ac.delete("/api/files/delete", params={"path": "default/todelete.txt"})
        assert r.status_code == 200
        r2 = await ac.get("/api/files/read", params={"path": "default/todelete.txt"})
        assert r2.status_code == 404


@pytest.mark.asyncio
async def test_grep_and_copy():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Write file with content to grep
        await ac.post("/api/files/write", json={
            "path": "default/grep_test.txt",
            "content": "this is a special matching line\nother line\n",
        })

        # Grep
        r_grep = await ac.get("/api/files/grep", params={"query": "special matching", "workspace": "default"})
        assert r_grep.status_code == 200
        results = r_grep.json()["results"]
        assert len(results) > 0
        assert "grep_test.txt" in results[0]["path"]
        assert "special matching line" in results[0]["content"]

        # Copy
        r_copy = await ac.post("/api/files/copy", json={
            "src": "default/grep_test.txt",
            "dst": "default/grep_test_copied.txt",
        })
        assert r_copy.status_code == 200

        # Read copied file
        r_read = await ac.get("/api/files/read", params={"path": "default/grep_test_copied.txt"})
        assert r_read.status_code == 200
        assert "special matching line" in r_read.json()["content"]


@pytest.mark.asyncio
async def test_workspaces():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Create workspace
        r_create = await ac.post("/api/files/workspaces", json={"name": "test_workspace"})
        assert r_create.status_code == 200

        # List workspaces
        r_list = await ac.get("/api/files/workspaces")
        assert r_list.status_code == 200
        workspaces = r_list.json()["workspaces"]
        assert "test_workspace" in workspaces
        assert "default" in workspaces
