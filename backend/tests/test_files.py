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
