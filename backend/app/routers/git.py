import asyncio
import contextlib
import logging
import re
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/api/git", tags=["git"])
logger = logging.getLogger(__name__)

# Accept the common, safe remote URL forms. Anything starting with "-" (option
# injection) or an unknown scheme is rejected before reaching ``git``.
_GIT_URL_RE = re.compile(r'^(https?://|git://|ssh://|git@[\w.-]+:)', re.IGNORECASE)


def resolve_git_dir(workspace: str, folder: str = "") -> Path:
    base = (settings.workspace_path / workspace.replace('\x00', '')).resolve()
    try:
        base.relative_to(settings.workspace_path.resolve())
    except ValueError:
        raise HTTPException(403, "Access denied") from None

    clean_folder = folder.replace('\x00', '').lstrip('/')
    if '..' in clean_folder.split('/') or '..' in workspace.replace('\x00', '').split('/'):
        raise HTTPException(403, "Access denied")

    resolved = (base / clean_folder).resolve()
    try:
        resolved.relative_to(base)
    except ValueError:
        raise HTTPException(403, "Access denied") from None

    if not resolved.exists():
        raise HTTPException(404, f"Directory not found: {folder}")
    if not resolved.is_dir():
        raise HTTPException(400, f"Path is not a directory: {folder}")

    # Walk up looking for .git
    curr = resolved
    while True:
        if (curr / ".git").exists():
            return curr
        if curr == base or curr == curr.parent:
            break
        curr = curr.parent

    # Check first-level subdirectories
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
    except TimeoutError:
        with contextlib.suppress(Exception):
            proc.kill()
        raise HTTPException(408, f"Git operation timed out after {timeout}s") from None
    except FileNotFoundError:
        raise HTTPException(500, "git is not installed in this environment") from None


class CloneBody(BaseModel):
    url: str
    workspace: str = "default"
    folder: str | None = None


@router.post("/clone")
async def clone(body: CloneBody):
    url = (body.url or "").replace('\x00', '').strip()
    if not url or not _GIT_URL_RE.match(url):
        raise HTTPException(400, "Invalid or unsupported repository URL")

    base = (settings.workspace_path / body.workspace.replace('\x00', '')).resolve()
    try:
        base.relative_to(settings.workspace_path.resolve())
    except ValueError:
        raise HTTPException(403, "Access denied") from None

    clean_folder = (body.folder or "").replace('\x00', '').lstrip('/')
    if '..' in clean_folder.split('/') or '..' in body.workspace.replace('\x00', '').split('/'):
        raise HTTPException(403, "Access denied")

    folder = clean_folder or url.split("/")[-1].removesuffix(".git")
    folder = folder.strip() or "repo"
    base.mkdir(parents=True, exist_ok=True)
    dest = (base / folder).resolve()

    try:
        dest.relative_to(base)
    except ValueError:
        raise HTTPException(403, "Access denied") from None

    if dest.exists():
        raise HTTPException(400, f"Folder '{folder}' already exists")

    # "--" stops git from treating a hostile URL/dest as a flag.
    result = await run_git(["clone", "--", url, str(dest)], str(base), timeout=120)
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
    branch = await _get_branch(cwd)
    ahead_behind = await _get_ahead_behind(cwd)
    return {"files": files, "branch": branch, **ahead_behind}


async def _get_branch(cwd: str) -> str:
    result = await run_git(["branch", "--show-current"], cwd)
    return result["stdout"].strip() if result["ok"] else "unknown"


async def _get_ahead_behind(cwd: str) -> dict:
    result = await run_git(["rev-list", "--left-right", "--count", "HEAD...@{u}"], cwd)
    if result["ok"] and result["stdout"].strip():
        parts = result["stdout"].strip().split()
        if len(parts) == 2:
            try:
                return {"ahead": int(parts[0]), "behind": int(parts[1])}
            except ValueError:
                pass
    return {"ahead": 0, "behind": 0}


@router.get("/diff")
async def git_diff(workspace: str = "default", folder: str = "", file: str = ""):
    cwd = str(resolve_git_dir(workspace, folder))

    if file:
        # Validate file path safety
        clean_file = file.replace('\x00', '')
        if '..' in clean_file.split('/') or clean_file.startswith('-'):
            raise HTTPException(403, "Access denied")

        # Try unstaged diff first, then staged
        result = await run_git(["diff", "--", clean_file], cwd)
        if not result["stdout"]:
            result = await run_git(["diff", "--cached", "--", clean_file], cwd)
        if not result["stdout"]:
            # New untracked file - show content as added
            result = await run_git(["diff", "--no-index", "/dev/null", clean_file], cwd)
    else:
        result = await run_git(["diff", "HEAD"], cwd)
        if not result["stdout"]:
            result = await run_git(["diff"], cwd)

    return {"diff": result["stdout"], "stderr": result.get("stderr", "")}


@router.get("/diff-stat")
async def git_diff_stat(workspace: str = "default", folder: str = ""):
    cwd = str(resolve_git_dir(workspace, folder))
    result = await run_git(["diff", "--stat"], cwd)
    staged = await run_git(["diff", "--cached", "--stat"], cwd)
    return {
        "unstaged": result["stdout"],
        "staged": staged["stdout"],
    }


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


class PullBody(BaseModel):
    workspace: str = "default"
    folder: str = ""


@router.post("/pull")
async def git_pull(body: PullBody):
    cwd = str(resolve_git_dir(body.workspace, body.folder))
    result = await run_git(["pull", "--rebase=false"], cwd, timeout=120)
    if not result["ok"]:
        raise HTTPException(400, result["stderr"] or result["stdout"])
    return {"status": "pulled", "output": result["stdout"]}


class PushBody(BaseModel):
    workspace: str = "default"
    folder: str = ""


@router.post("/push")
async def git_push(body: PushBody):
    cwd = str(resolve_git_dir(body.workspace, body.folder))
    result = await run_git(["push"], cwd, timeout=120)
    if not result["ok"]:
        raise HTTPException(400, result["stderr"] or result["stdout"])
    return {"status": "pushed", "output": result["stdout"]}


@router.get("/log")
async def git_log(workspace: str = "default", folder: str = "", limit: int = 30):
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


@router.get("/branches")
async def git_branches(workspace: str = "default", folder: str = ""):
    cwd = str(resolve_git_dir(workspace, folder))
    result = await run_git(["branch", "-a", "--format=%(refname:short)"], cwd)
    if not result["ok"]:
        raise HTTPException(400, result["stderr"])
    branches = [b.strip() for b in result["stdout"].splitlines() if b.strip()]
    return {"branches": branches}
