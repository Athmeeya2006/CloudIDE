import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

transport = ASGITransport(app=app)


def client():
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_write_and_read():
    async with client() as ac:
        r = await ac.post("/api/files/write", json={
            "path": "default/hello.py",
            "content": "print('hello')",
        })
        assert r.status_code == 200
        assert r.json()["status"] == "saved"

        r = await ac.get("/api/files/read", params={"path": "default/hello.py"})
        assert r.status_code == 200
        assert r.json()["content"] == "print('hello')"
        assert r.json()["encoding"] == "utf-8"


@pytest.mark.asyncio
async def test_read_missing_file_404():
    async with client() as ac:
        r = await ac.get("/api/files/read", params={"path": "default/nope.txt"})
        assert r.status_code == 404


@pytest.mark.asyncio
async def test_delete_file():
    async with client() as ac:
        await ac.post("/api/files/write", json={"path": "default/todelete.txt", "content": "x"})
        r = await ac.delete("/api/files/delete", params={"path": "default/todelete.txt"})
        assert r.status_code == 200
        r2 = await ac.get("/api/files/read", params={"path": "default/todelete.txt"})
        assert r2.status_code == 404


@pytest.mark.asyncio
async def test_delete_missing_404():
    async with client() as ac:
        r = await ac.delete("/api/files/delete", params={"path": "default/ghost.txt"})
        assert r.status_code == 404


@pytest.mark.asyncio
async def test_create_conflict_409():
    async with client() as ac:
        r1 = await ac.post("/api/files/create", json={"path": "default/dup.txt"})
        assert r1.status_code == 200
        r2 = await ac.post("/api/files/create", json={"path": "default/dup.txt"})
        assert r2.status_code == 409


@pytest.mark.asyncio
async def test_create_and_delete_directory():
    async with client() as ac:
        r = await ac.post("/api/files/create", json={"path": "default/mydir", "is_dir": True})
        assert r.status_code == 200
        r2 = await ac.delete("/api/files/delete", params={"path": "default/mydir"})
        assert r2.status_code == 200


@pytest.mark.asyncio
async def test_rename_and_conflict():
    async with client() as ac:
        await ac.post("/api/files/write", json={"path": "default/a.txt", "content": "a"})
        r = await ac.post("/api/files/rename", json={"old_path": "default/a.txt", "new_path": "default/b.txt"})
        assert r.status_code == 200
        # b now exists; renaming a missing source -> 404
        r2 = await ac.post("/api/files/rename", json={"old_path": "default/a.txt", "new_path": "default/c.txt"})
        assert r2.status_code == 404
        # conflict: write a new a.txt then rename onto existing b.txt
        await ac.post("/api/files/write", json={"path": "default/a.txt", "content": "a"})
        r3 = await ac.post("/api/files/rename", json={"old_path": "default/a.txt", "new_path": "default/b.txt"})
        assert r3.status_code == 409


@pytest.mark.asyncio
async def test_grep_and_copy():
    async with client() as ac:
        await ac.post("/api/files/write", json={
            "path": "default/grep_test.txt",
            "content": "this is a special matching line\nother line\n",
        })
        r_grep = await ac.get("/api/files/grep", params={"query": "special matching", "workspace": "default"})
        assert r_grep.status_code == 200
        results = r_grep.json()["results"]
        assert len(results) > 0
        assert "grep_test.txt" in results[0]["path"]
        assert "special matching line" in results[0]["content"]

        r_copy = await ac.post("/api/files/copy", json={
            "src": "default/grep_test.txt",
            "dst": "default/grep_test_copied.txt",
        })
        assert r_copy.status_code == 200

        r_read = await ac.get("/api/files/read", params={"path": "default/grep_test_copied.txt"})
        assert r_read.status_code == 200
        assert "special matching line" in r_read.json()["content"]


@pytest.mark.asyncio
async def test_grep_case_sensitivity():
    async with client() as ac:
        await ac.post("/api/files/write", json={"path": "default/case.txt", "content": "Hello WORLD\n"})
        r_ci = await ac.get("/api/files/grep", params={"query": "world", "case_sensitive": False})
        assert any("case.txt" in m["path"] for m in r_ci.json()["results"])
        r_cs = await ac.get("/api/files/grep", params={"query": "world", "case_sensitive": True})
        assert not any("case.txt" in m["path"] for m in r_cs.json()["results"])


@pytest.mark.asyncio
async def test_grep_query_validation():
    async with client() as ac:
        r = await ac.get("/api/files/grep", params={"query": "x" * 201})
        assert r.status_code == 400


@pytest.mark.asyncio
async def test_search_by_filename():
    async with client() as ac:
        await ac.post("/api/files/write", json={"path": "default/findme_unique.py", "content": "1"})
        r = await ac.get("/api/files/search", params={"query": "findme_unique"})
        assert r.status_code == 200
        assert any("findme_unique.py" in p for p in r.json()["results"])


@pytest.mark.asyncio
async def test_tree_skips_heavy_dirs(tmp_path):
    # Build a workspace with node_modules + .git that must be excluded.
    ws = tmp_path / "default"
    (ws / "node_modules" / "pkg").mkdir(parents=True)
    (ws / "node_modules" / "pkg" / "index.js").write_text("x")
    (ws / ".git").mkdir(parents=True)
    (ws / ".git" / "config").write_text("x")
    (ws / "src").mkdir()
    (ws / "src" / "app.py").write_text("print(1)")

    async with client() as ac:
        r = await ac.get("/api/files/tree", params={"workspace": "default"})
    assert r.status_code == 200
    names = [c["name"] for c in r.json()["children"]]
    assert "src" in names
    assert "node_modules" not in names
    assert ".git" not in names


@pytest.mark.asyncio
async def test_workspace_param_traversal_blocked():
    async with client() as ac:
        for ws in ["../../etc", "..", "a/b"]:
            r = await ac.get("/api/files/tree", params={"workspace": ws})
            assert r.status_code == 400, ws
            r2 = await ac.get("/api/files/grep", params={"query": "x", "workspace": ws})
            assert r2.status_code == 400, ws


@pytest.mark.asyncio
async def test_path_traversal_blocked():
    async with client() as ac:
        r = await ac.get("/api/files/read", params={"path": "../../../etc/passwd"})
        assert r.status_code == 403
        r2 = await ac.post("/api/files/write", json={"path": "../escape.txt", "content": "x"})
        assert r2.status_code == 403


@pytest.mark.asyncio
async def test_workspaces_create_and_list():
    async with client() as ac:
        r_create = await ac.post("/api/files/workspaces", json={"name": "test_workspace"})
        assert r_create.status_code == 200
        r_list = await ac.get("/api/files/workspaces")
        assert r_list.status_code == 200
        workspaces = r_list.json()["workspaces"]
        assert "test_workspace" in workspaces
        assert "default" in workspaces


@pytest.mark.asyncio
async def test_workspaces_create_invalid_name():
    async with client() as ac:
        for bad in ["../evil", "a/b", ".."]:
            r = await ac.post("/api/files/workspaces", json={"name": bad})
            assert r.status_code == 400, bad
