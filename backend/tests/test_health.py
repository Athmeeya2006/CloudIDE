import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_health():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_file_tree(tmp_path, monkeypatch):
    monkeypatch.setenv("WORKSPACE_BASE", str(tmp_path))
    from app import config
    config.settings = config.Settings()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r = await ac.get("/api/files/tree", params={"workspace": "default"})
    assert r.status_code == 200
    assert r.json()["type"] == "directory"
