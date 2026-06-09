import pytest
import subprocess
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
def git_repo(tmp_path):
    # Initialize a dummy git repo inside default workspace dir
    default_ws = tmp_path / "default"
    default_ws.mkdir(parents=True, exist_ok=True)
    subprocess.run(["git", "init"], cwd=str(default_ws), capture_output=True)
    subprocess.run(["git", "config", "user.name", "Test User"], cwd=str(default_ws), capture_output=True)
    subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=str(default_ws), capture_output=True)
    
    # Create a file and commit it
    test_file = default_ws / "test.txt"
    test_file.write_text("hello")
    subprocess.run(["git", "add", "test.txt"], cwd=str(default_ws), capture_output=True)
    subprocess.run(["git", "commit", "-m", "initial commit"], cwd=str(default_ws), capture_output=True)
    
    return tmp_path


@pytest.mark.asyncio
async def test_git_status_and_log(git_repo):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Status
        r = await ac.get("/api/git/status", params={"workspace": "default"})
        assert r.status_code == 200
        data = r.json()
        assert "branch" in data
        assert "files" in data

        # Log
        r_log = await ac.get("/api/git/log", params={"workspace": "default"})
        assert r_log.status_code == 200
        commits = r_log.json()["commits"]
        assert len(commits) > 0
        assert commits[0]["message"] in ["initial commit", "done"]


@pytest.mark.asyncio
async def test_git_path_traversal_blocked(git_repo):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Traversal in workspace name
        r1 = await ac.get("/api/git/status", params={"workspace": "../default"})
        assert r1.status_code == 403

        # Traversal in folder name
        r2 = await ac.get("/api/git/status", params={"workspace": "default", "folder": "../../"})
        assert r2.status_code == 403
