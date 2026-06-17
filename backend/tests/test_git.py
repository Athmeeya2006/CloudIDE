import subprocess

import pytest
from httpx import ASGITransport, AsyncClient

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
        assert "ahead" in data
        assert "behind" in data

        # Log
        r_log = await ac.get("/api/git/log", params={"workspace": "default"})
        assert r_log.status_code == 200
        commits = r_log.json()["commits"]
        assert len(commits) > 0
        assert commits[0]["message"] in ["initial commit", "done"]


@pytest.mark.asyncio
async def test_git_diff_and_branches(git_repo):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Make a change to test.txt
        default_ws = git_repo / "default"
        test_file = default_ws / "test.txt"
        test_file.write_text("hello world")

        # Get diff-stat
        r_stat = await ac.get("/api/git/diff-stat", params={"workspace": "default"})
        assert r_stat.status_code == 200
        assert "unstaged" in r_stat.json()
        assert "staged" in r_stat.json()

        # Get diff for specific file
        r_diff = await ac.get("/api/git/diff", params={"workspace": "default", "file": "test.txt"})
        assert r_diff.status_code == 200
        assert "diff" in r_diff.json()
        assert "hello world" in r_diff.json()["diff"]

        # Branches
        r_branches = await ac.get("/api/git/branches", params={"workspace": "default"})
        assert r_branches.status_code == 200
        assert len(r_branches.json()["branches"]) > 0


@pytest.mark.asyncio
async def test_git_path_traversal_blocked(git_repo):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Traversal in workspace name
        r1 = await ac.get("/api/git/status", params={"workspace": "../default"})
        assert r1.status_code == 403

        # Traversal in folder name
        r2 = await ac.get("/api/git/status", params={"workspace": "default", "folder": "../../"})
        assert r2.status_code == 403


@pytest.mark.asyncio
async def test_git_commit_flow(git_repo):
    default_ws = git_repo / "default"
    (default_ws / "new_file.txt").write_text("new content")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # There should be an untracked change
        r = await ac.get("/api/git/status", params={"workspace": "default"})
        assert any(f["path"] == "new_file.txt" for f in r.json()["files"])

        # Commit everything
        r_commit = await ac.post("/api/git/commit", json={
            "workspace": "default", "message": "add new file", "add_all": True,
        })
        assert r_commit.status_code == 200

        # Working tree should now be clean
        r2 = await ac.get("/api/git/status", params={"workspace": "default"})
        assert r2.json()["files"] == []

        # The commit shows up in the log
        r_log = await ac.get("/api/git/log", params={"workspace": "default"})
        assert r_log.json()["commits"][0]["message"] == "add new file"


@pytest.mark.asyncio
async def test_git_clone_rejects_invalid_url(git_repo):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Empty / non-URL
        r = await ac.post("/api/git/clone", json={"url": "not a url", "workspace": "default"})
        assert r.status_code == 400


@pytest.mark.asyncio
async def test_git_clone_blocks_argument_injection(git_repo):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # A URL starting with "-" would be treated as a git flag; must be rejected.
        r = await ac.post("/api/git/clone", json={
            "url": "--upload-pack=touch /tmp/pwned", "workspace": "default",
        })
        assert r.status_code == 400
