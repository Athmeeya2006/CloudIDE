import os
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import asyncio
import logging

from app.config import settings

router = APIRouter(prefix="/api/git", tags=["git"])
logger = logging.getLogger(__name__)


def ws_path(workspace: str) -> Path:
    p = settings.workspace_path / workspace
    p.mkdir(parents=True, exist_ok=True)
    return p


async def run_git(args: list[str], cwd: str, timeout: int = 60) -> dict:
    try:
        proc = await asyncio.create_subprocess_exec(
            "git", *args,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        return {
            "returncode": proc.returncode,
            "stdout": stdout.decode(errors="replace"),
            "stderr": stderr.decode(errors="replace"),
            "ok": proc.returncode == 0,
        }
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except Exception:
            pass
        raise HTTPException(408, f"Git operation timed out after {timeout}s")
    except FileNotFoundError:
        raise HTTPException(500, "git is not installed in this environment")


class CloneBody(BaseModel):
    url: str
    workspace: str = "default"
    folder: Optional[str] = None


@router.post("/clone")
async def clone(body: CloneBody):
    base = ws_path(body.workspace)
    folder = body.folder or body.url.split("/")[-1].removesuffix(".git")
    dest = base / folder
    if dest.exists():
        raise HTTPException(400, f"Folder '{folder}' already exists")
    result = await run_git(["clone", body.url, str(dest)], str(base))
    if not result["ok"]:
        raise HTTPException(400, result["stderr"])
    return {"status": "cloned", "path": str(dest.relative_to(settings.workspace_path))}


@router.get("/status")
async def git_status(workspace: str = "default", folder: str = ""):
    cwd = str(ws_path(workspace) / folder)
    result = await run_git(["status", "--porcelain", "-u"], cwd)
    if not result["ok"]:
        raise HTTPException(400, result["stderr"])
    lines = [l for l in result["stdout"].splitlines() if l.strip()]
    files = []
    for line in lines:
        status = line[:2].strip()
        path = line[3:].strip()
        files.append({"status": status, "path": path})
    return {"files": files, "branch": await _get_branch(cwd)}


async def _get_branch(cwd: str) -> str:
    result = await run_git(["branch", "--show-current"], cwd)
    return result["stdout"].strip() if result["ok"] else "unknown"


class CommitBody(BaseModel):
    workspace: str = "default"
    folder: str = ""
    message: str
    add_all: bool = True


@router.post("/commit")
async def commit(body: CommitBody):
    cwd = str(ws_path(body.workspace) / body.folder)
    if body.add_all:
        await run_git(["add", "-A"], cwd)
    result = await run_git(["commit", "-m", body.message], cwd)
    if not result["ok"]:
        raise HTTPException(400, result["stderr"])
    return {"status": "committed", "output": result["stdout"]}


@router.get("/log")
async def git_log(workspace: str = "default", folder: str = "", limit: int = 20):
    cwd = str(ws_path(workspace) / folder)
    result = await run_git(
        ["log", f"--max-count={limit}", "--pretty=format:%H|%an|%ae|%ai|%s"],
        cwd,
    )
    if not result["ok"]:
        raise HTTPException(400, result["stderr"])
    commits = []
    for line in result["stdout"].splitlines():
        if "|" in line:
            parts = line.split("|", 4)
            commits.append({
                "hash": parts[0],
                "author": parts[1],
                "email": parts[2],
                "date": parts[3],
                "message": parts[4] if len(parts) > 4 else "",
            })
    return {"commits": commits}
