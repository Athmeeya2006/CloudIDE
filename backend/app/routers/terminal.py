import asyncio
import os
import pty
import select
import struct
import fcntl
import termios
import subprocess
import json
import logging
import shutil
from typing import Dict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException

from app.routers.processes import resolve_workspace_cwd

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/terminal", tags=["terminal"])


class TerminalSession:
    def __init__(self, session_id: str, cwd: str):
        self.session_id = session_id
        self.cwd = cwd
        self.master_fd: int | None = None
        self.process: subprocess.Popen | None = None

    def start(self) -> "TerminalSession":
        master_fd, slave_fd = pty.openpty()
        self.master_fd = master_fd

        shell = (
            shutil.which('bash') or
            shutil.which('sh') or
            '/bin/sh'
        )

        env = {
            **os.environ,
            "TERM": "xterm-256color",
            "COLORTERM": "truecolor",
            "LINES": "24",
            "COLUMNS": "80",
            "HOME": os.path.expanduser("~"),
            "SHELL": shell,
            "WORKSPACE_DIR": self.cwd,
        }

        self.process = subprocess.Popen(
            [shell],
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            cwd=self.cwd,
            env=env,
            close_fds=True,
            start_new_session=True,
        )
        os.close(slave_fd)
        return self

    def resize(self, rows: int, cols: int):
        if self.master_fd is not None:
            try:
                fcntl.ioctl(
                    self.master_fd,
                    termios.TIOCSWINSZ,
                    struct.pack("HHHH", rows, cols, 0, 0),
                )
            except OSError:
                pass

    def write(self, data: bytes):
        if self.master_fd is not None:
            try:
                os.write(self.master_fd, data)
            except OSError:
                pass

    def close(self):
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=2)
            except Exception:
                try:
                    self.process.kill()
                except Exception:
                    pass
        if self.master_fd is not None:
            try:
                os.close(self.master_fd)
            except OSError:
                pass
            self.master_fd = None


class TerminalManager:
    def __init__(self):
        self._sessions: Dict[str, TerminalSession] = {}

    def create(self, session_id: str, cwd: str) -> TerminalSession:
        if session_id in self._sessions:
            self._sessions[session_id].close()
        s = TerminalSession(session_id, cwd).start()
        self._sessions[session_id] = s
        return s

    def get(self, session_id: str) -> TerminalSession | None:
        return self._sessions.get(session_id)

    def close(self, session_id: str):
        if s := self._sessions.pop(session_id, None):
            s.close()


manager = TerminalManager()


@router.websocket("/ws/{session_id}")
async def terminal_ws(websocket: WebSocket, session_id: str):
    await websocket.accept()

    cwd_param = websocket.query_params.get("cwd", "default")
    try:
        cwd = str(resolve_workspace_cwd(cwd_param))
    except HTTPException as e:
        await websocket.close(code=4003, reason=e.detail)
        return

    os.makedirs(cwd, exist_ok=True)

    session = manager.create(session_id, cwd)
    loop = asyncio.get_running_loop()

    async def read_loop():
        while True:
            if session.master_fd is None:
                break
            try:
                data = await loop.run_in_executor(None, _blocking_read, session.master_fd)
            except OSError:
                break
            if data:
                try:
                    await websocket.send_bytes(data)
                except Exception:
                    break
            if session.process and session.process.poll() is not None:
                break
            await asyncio.sleep(0.008)

    def _blocking_read(fd: int) -> bytes:
        r, _, _ = select.select([fd], [], [], 0.05)
        if r:
            try:
                return os.read(fd, 4096)
            except OSError:
                return b""
        return b""

    read_task = asyncio.create_task(read_loop())

    try:
        while True:
            msg = await websocket.receive()
            if msg["type"] == "websocket.disconnect":
                break
            if "bytes" in msg and msg["bytes"]:
                session.write(msg["bytes"])
            elif "text" in msg and msg["text"]:
                is_ctrl = False
                try:
                    ctrl = json.loads(msg["text"])
                except (ValueError, TypeError):
                    ctrl = None
                if isinstance(ctrl, dict) and ctrl.get("type") == "resize":
                    is_ctrl = True
                    try:
                        rows = max(1, min(int(ctrl.get("rows", 24)), 1000))
                        cols = max(1, min(int(ctrl.get("cols", 80)), 1000))
                        session.resize(rows, cols)
                    except (ValueError, TypeError):
                        pass
                if not is_ctrl:
                    session.write(msg["text"].encode())
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.exception(f"Terminal WS error: {e}")
    finally:
        read_task.cancel()
        manager.close(session_id)


@router.delete("/{session_id}")
async def close_terminal(session_id: str):
    manager.close(session_id)
    return {"status": "closed"}
