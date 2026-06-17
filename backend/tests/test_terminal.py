"""Interactive PTY terminal tests.

Uses the synchronous TestClient. The PTY echoes typed input and runs commands,
so reading is bounded by breaking as soon as the marker appears.
"""
import json

from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.main import app


def test_terminal_delete_endpoint():
    with TestClient(app) as c:
        r = c.delete("/api/terminal/some-session-id")
        assert r.status_code == 200
        assert r.json()["status"] == "closed"


def test_terminal_ws_runs_command():
    with TestClient(app) as c:
        with c.websocket_connect("/api/terminal/ws/test-sess?cwd=default") as ws:
            # A resize control message must not be typed into the shell.
            ws.send_text(json.dumps({"type": "resize", "rows": 30, "cols": 100}))
            ws.send_bytes(b"echo terminal-marker-123\n")
            collected = b""
            for _ in range(60):
                collected += ws.receive_bytes()
                if b"terminal-marker-123" in collected:
                    break
        assert b"terminal-marker-123" in collected


def test_terminal_ws_run_button_pattern(tmp_path):
    # Reproduce exactly what the front-end "Run" button sends: a cd into
    # $WORKSPACE_DIR followed by the run command, terminated with CR.
    (tmp_path / "default").mkdir(parents=True, exist_ok=True)
    (tmp_path / "default" / "run_target.py").write_text("print('RUN_RESULT', 2 + 2)\n")
    with TestClient(app) as c:
        with c.websocket_connect("/api/terminal/ws/run-sess?cwd=default") as ws:
            ws.send_bytes(b'cd "$WORKSPACE_DIR/." && python3 -u "run_target.py"\r')
            collected = b""
            for _ in range(80):
                collected += ws.receive_bytes()
                if b"RUN_RESULT 4" in collected:
                    break
        assert b"RUN_RESULT 4" in collected


def test_terminal_ws_rejects_bad_cwd():
    disconnected = False
    try:
        with (
            TestClient(app) as c,
            c.websocket_connect("/api/terminal/ws/bad?cwd=../../etc") as ws,
        ):
            ws.receive_bytes()
    except WebSocketDisconnect as e:
        disconnected = True
        assert e.code == 4003
    except Exception:
        disconnected = True
    assert disconnected
