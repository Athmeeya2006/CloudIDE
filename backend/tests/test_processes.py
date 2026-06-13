"""Process manager + websocket log streaming tests.

These use the synchronous Starlette TestClient because they exercise real
subprocesses and websockets. Commands are short-lived (echo) so the streams
always terminate and the tests cannot hang.
"""
import time

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.routers.processes import resolve_workspace_cwd


def test_resolve_workspace_cwd_ok():
    p = resolve_workspace_cwd("default")
    assert p.name == "default"


@pytest.mark.parametrize("evil", ["../../etc", "default/../../.."])
def test_resolve_workspace_cwd_traversal(evil):
    with pytest.raises(HTTPException) as exc:
        resolve_workspace_cwd(evil)
    assert exc.value.status_code == 403


def test_create_invalid_command_rejected():
    with TestClient(app) as c:
        r = c.post("/api/processes/", json={"command": "   ", "cwd": "default"})
        assert r.status_code == 422  # pydantic validation error


def test_create_bad_cwd_404():
    with TestClient(app) as c:
        r = c.post("/api/processes/", json={"command": "echo hi", "cwd": "default/does-not-exist"})
        assert r.status_code == 404


def test_process_lifecycle_and_logs():
    with TestClient(app) as c:
        r = c.post("/api/processes/", json={"command": "echo proc-stream-test", "cwd": "default"})
        assert r.status_code == 200
        pid = r.json()["id"]
        assert r.json()["status"] == "running"

        # Stream logs until we observe our marker (bounded: echo exits quickly).
        collected = ""
        with c.websocket_connect(f"/api/processes/{pid}/logs") as ws:
            for _ in range(40):
                try:
                    collected += ws.receive_text()
                except Exception:
                    break
                if "proc-stream-test" in collected:
                    break
        assert "proc-stream-test" in collected

        # After the echo exits the process should no longer be running.
        time.sleep(0.2)
        info = c.get(f"/api/processes/{pid}").json()
        assert info["status"] in ("stopped", "error")

        # Cleanup
        assert c.delete(f"/api/processes/{pid}").status_code == 200
        assert c.get(f"/api/processes/{pid}").status_code == 404


def test_list_processes():
    with TestClient(app) as c:
        r = c.get("/api/processes/")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


def test_logs_ws_unknown_process():
    with TestClient(app) as c:
        with c.websocket_connect("/api/processes/nonexistent/logs") as ws:
            msg = ws.receive_json()
            assert "error" in msg
