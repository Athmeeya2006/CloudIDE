import asyncio
import os
import subprocess
import signal
import uuid
import logging
from pathlib import Path
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, field_validator
from app.config import settings

router = APIRouter(prefix="/api/processes", tags=["processes"])
logger = logging.getLogger(__name__)


def resolve_workspace_cwd(cwd_param: str) -> Path:
    clean = cwd_param.replace('\x00', '').strip()
    for prefix in [str(settings.workspace_path)]:
        if clean.startswith(prefix):
            clean = clean[len(prefix):].lstrip('/')
            break
    base = settings.workspace_path.resolve()
    resolved = (base / clean).resolve()
    try:
        resolved.relative_to(base)
    except ValueError:
        raise HTTPException(403, "Access denied")
    return resolved


class ProcessCreate(BaseModel):
    command: str
    cwd: str
    name: Optional[str] = None
    env: Optional[Dict[str, str]] = None

    @field_validator('command')
    @classmethod
    def clean_command(cls, v: str) -> str:
        v = v.replace('\x00', '').strip()
        if len(v) > 2048:
            raise ValueError("Command too long")
        if not v:
            raise ValueError("Command cannot be empty")
        return v

    @field_validator('cwd')
    @classmethod
    def clean_cwd(cls, v: str) -> str:
        return v.replace('\x00', '').strip()


class ManagedProcess:
    def __init__(self, pid: str, command: str, name: str, cwd: str):
        self.pid = pid
        self.command = command
        self.name = name
        self.cwd = cwd
        self.proc: Optional[subprocess.Popen] = None
        self.status: str = "stopped"
        self.logs: List[str] = []
        self._queues: List[asyncio.Queue] = []
        self._task: Optional[asyncio.Task] = None

    async def start(self, env: Optional[Dict] = None):
        penv = {**os.environ}
        if env:
            penv.update(env)
        self.logs.clear()
        self.proc = subprocess.Popen(
            self.command,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=self.cwd,
            env=penv,
            text=True,
            bufsize=1,
            preexec_fn=os.setsid,
        )
        self.status = "running"
        self._task = asyncio.create_task(self._stream())

    async def _stream(self):
        loop = asyncio.get_event_loop()
        while self.proc and self.proc.poll() is None:
            try:
                line = await loop.run_in_executor(None, self.proc.stdout.readline)
            except Exception:
                break
            if line:
                self.logs.append(line)
                if len(self.logs) > 5000:
                    self.logs = self.logs[-4000:]
                for q in list(self._queues):
                    try:
                        q.put_nowait(line)
                    except asyncio.QueueFull:
                        pass
            elif self.proc.poll() is not None:
                break

        rc = self.proc.returncode if self.proc else -1
        exit_msg = f"\n[Process exited with code {rc}]\n"
        self.logs.append(exit_msg)
        for q in list(self._queues):
            try:
                q.put_nowait(exit_msg)
            except Exception:
                pass

        self.status = "stopped" if rc == 0 else "error"
        for q in list(self._queues):
            try:
                q.put_nowait(None)
            except Exception:
                pass

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=2000)
        self._queues.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        try:
            self._queues.remove(q)
        except ValueError:
            pass

    def stop(self):
        if self.proc and self.proc.poll() is None:
            try:
                os.killpg(os.getpgid(self.proc.pid), signal.SIGTERM)
                self.proc.wait(timeout=1.0)
            except Exception:
                try:
                    os.killpg(os.getpgid(self.proc.pid), signal.SIGKILL)
                except Exception:
                    pass
        if self._task and not self._task.done():
            self._task.cancel()
        self.status = "stopped"

    def to_dict(self) -> dict:
        return {
            "id": self.pid,
            "name": self.name,
            "command": self.command,
            "status": self.status,
            "os_pid": self.proc.pid if self.proc else None,
            "log_count": len(self.logs),
        }


class ProcessManager:
    def __init__(self):
        self._procs: Dict[str, ManagedProcess] = {}

    def create(self, cmd: str, name: str, cwd: str) -> ManagedProcess:
        # Remove dead processes first
        dead = [pid for pid, p in self._procs.items() if p.status == 'stopped']
        for pid in dead:
            del self._procs[pid]

        if len(self._procs) >= settings.max_processes:
            raise HTTPException(429, f"Max processes ({settings.max_processes}) reached")
        
        pid = str(uuid.uuid4())[:8]
        p = ManagedProcess(pid, cmd, name, cwd)
        self._procs[pid] = p
        return p

    def get(self, pid: str) -> Optional[ManagedProcess]:
        return self._procs.get(pid)

    def list_all(self) -> list:
        return [p.to_dict() for p in self._procs.values()]

    def remove(self, pid: str):
        if p := self._procs.pop(pid, None):
            p.stop()


proc_mgr = ProcessManager()


@router.post("/")
async def create_process(body: ProcessCreate):
    resolved_cwd = resolve_workspace_cwd(body.cwd)
    if not resolved_cwd.exists() or not resolved_cwd.is_dir():
        raise HTTPException(404, f"Directory not found: {body.cwd}")
    p = proc_mgr.create(body.command, body.name or body.command[:40], str(resolved_cwd))
    await p.start(body.env)
    return p.to_dict()


@router.get("/")
async def list_processes():
    return proc_mgr.list_all()


@router.get("/{pid}")
async def get_process(pid: str):
    p = proc_mgr.get(pid)
    if not p:
        raise HTTPException(404, "Process not found")
    return p.to_dict()


@router.post("/{pid}/stop")
async def stop_process(pid: str):
    p = proc_mgr.get(pid)
    if not p:
        raise HTTPException(404, "Process not found")
    p.stop()
    return p.to_dict()


@router.post("/{pid}/restart")
async def restart_process(pid: str):
    p = proc_mgr.get(pid)
    if not p:
        raise HTTPException(404, "Process not found")
    p.stop()
    await p.start()
    return p.to_dict()


@router.delete("/{pid}")
async def delete_process(pid: str):
    proc_mgr.remove(pid)
    return {"status": "deleted"}


@router.websocket("/{pid}/logs")
async def process_logs_ws(websocket: WebSocket, pid: str):
    await websocket.accept()
    p = proc_mgr.get(pid)
    if not p:
        await websocket.send_json({"error": "not found"})
        await websocket.close()
        return

    # Replay existing logs
    for line in p.logs:
        try:
            await websocket.send_text(line)
        except Exception:
            return

    q = p.subscribe()
    try:
        while True:
            try:
                line = await asyncio.wait_for(q.get(), timeout=30)
            except asyncio.TimeoutError:
                try:
                    await websocket.send_text("\x00")  # keepalive
                except Exception:
                    break
                continue
            if line is None:
                break
            try:
                await websocket.send_text(line)
            except Exception:
                break
    except WebSocketDisconnect:
        pass
    finally:
        p.unsubscribe(q)
