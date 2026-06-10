from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import asyncio
import logging

from app.config import settings

router = APIRouter(prefix="/api/git", tags=["git"])
logger = logging.getLogger(__name__)


def resolve_git_dir(workspace: str, folder: str = "") -> Path:
    # Ensure workspace base exists
    base = (settings.workspace_path / workspace.replace('\x00', '')).resolve()
    # Ensure workspace doesn't escape settings.workspace_path
    try:
        base.relative_to(settings.workspace_path.resolve())
    except ValueError:
        raise HTTPException(403, "Access denied")

    # Clean the folder path
    clean_folder = folder.replace('\x00', '').lstrip('/')
    if '..' in clean_folder.split('/') or '..' in workspace.replace('\x00', '').split('/'):
        raise HTTPException(403, "Access denied")

    resolved = (base / clean_folder).resolve()
    try:
        resolved.relative_to(base)
    except ValueError:
        raise HTTPException(403, "Access denied")

    # Ensure the directory actually exists (git operations must run in existing folders)
    if not resolved.exists():
        raise HTTPException(404, f"Directory not found: {folder}")
    if not resolved.is_dir():
        raise HTTPException(400, f"Path is not a directory: {folder}")

    # Auto-detect git repository:
    # 1. Traverse upwards from resolved directory to base, looking for .git folder
    curr = resolved
    while True:
        if (curr / ".git").exists():
            return curr
        if curr == base or curr == curr.parent:
            break
        curr = curr.parent

    # 2. If base itself is not a git repo, check first-level subdirectories of base
    try:
        for p in base.iterdir():
            if p.is_dir() and (p / ".git").exists():
                return p
    except Exception:
        pass

    return resolved


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
    # For clone, the workspace base must exist, but the destination folder will be created.
    # So resolve the parent/base first.
    base = (settings.workspace_path / body.workspace.replace('\x00', '')).resolve()
    try:
        base.relative_to(settings.workspace_path.resolve())
    except ValueError:
        raise HTTPException(403, "Access denied")

    # Check folder path safety
    clean_folder = (body.folder or "").replace('\x00', '').lstrip('/')
    if '..' in clean_folder.split('/') or '..' in body.workspace.replace('\x00', '').split('/'):
        raise HTTPException(403, "Access denied")

    folder = clean_folder or body.url.split("/")[-1].removesuffix(".git")
    dest = (base / folder).resolve()

    try:
        dest.relative_to(base)
    except ValueError:
        raise HTTPException(403, "Access denied")

    if dest.exists():
        raise HTTPException(400, f"Folder '{folder}' already exists")

    # Run clone inside base
    result = await run_git(["clone", body.url, str(dest)], str(base))
    if not result["ok"]:
        raise HTTPException(400, result["stderr"])
    return {"status": "cloned", "path": str(dest.relative_to(settings.workspace_path))}


@router.get("/status")
async def git_status(workspace: str = "default", folder: str = ""):
    cwd = str(resolve_git_dir(workspace, folder))
    result = await run_git(["status", "--porcelain", "-u"], cwd)
    if not result["ok"]:
        raise HTTPException(400, result["stderr"])
    lines = [item for item in result["stdout"].splitlines() if item.strip()]
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
    cwd = str(resolve_git_dir(body.workspace, body.folder))
    if body.add_all:
        await run_git(["add", "-A"], cwd)
    result = await run_git(["commit", "-m", body.message], cwd)
    if not result["ok"]:
        raise HTTPException(400, result["stderr"])
    return {"status": "committed", "output": result["stdout"]}


@router.get("/log")
async def git_log(workspace: str = "default", folder: str = "", limit: int = 20):
    cwd = str(resolve_git_dir(workspace, folder))
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
