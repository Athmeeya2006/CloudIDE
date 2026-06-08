import os
import shutil
from pathlib import Path
from typing import Optional
import aiofiles
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/api/files", tags=["files"])


def resolve(path: str) -> Path:
    """Resolve a workspace-relative path and guard against traversal."""
    base = settings.workspace_path.resolve()
    resolved = (base / path.lstrip("/")).resolve()
    if not str(resolved).startswith(str(base)):
        raise HTTPException(403, "Access denied")
    return resolved


def node(p: Path, base: Path) -> dict:
    rel = str(p.relative_to(base))
    if p.is_dir():
        children = sorted(p.iterdir(), key=lambda x: (x.is_file(), x.name.lower()))
        return {
            "name": p.name,
            "path": rel,
            "type": "directory",
            "children": [node(c, base) for c in children],
        }
    return {
        "name": p.name,
        "path": rel,
        "type": "file",
        "size": p.stat().st_size,
        "modified": p.stat().st_mtime,
    }


@router.get("/tree")
async def get_tree(workspace: str = "default"):
    base = settings.workspace_path / workspace
    base.mkdir(parents=True, exist_ok=True)
    return node(base, settings.workspace_path)


class WriteBody(BaseModel):
    path: str
    content: str


@router.post("/write")
async def write_file(body: WriteBody):
    full = resolve(body.path)
    full.parent.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(full, "w", encoding="utf-8") as f:
        await f.write(body.content)
    return {"status": "saved", "path": body.path}


@router.get("/read")
async def read_file(path: str):
    full = resolve(path)
    if not full.exists():
        raise HTTPException(404, "File not found")
    if full.is_dir():
        raise HTTPException(400, "Path is a directory")

    # Detect binary
    try:
        async with aiofiles.open(full, "r", encoding="utf-8") as f:
            content = await f.read()
        return {"path": path, "content": content, "encoding": "utf-8"}
    except UnicodeDecodeError:
        return {"path": path, "content": "", "encoding": "binary", "error": "Binary file"}


class CreateBody(BaseModel):
    path: str
    is_dir: bool = False


@router.post("/create")
async def create(body: CreateBody):
    full = resolve(body.path)
    if body.is_dir:
        full.mkdir(parents=True, exist_ok=True)
    else:
        full.parent.mkdir(parents=True, exist_ok=True)
        full.touch(exist_ok=True)
    return {"status": "created", "path": body.path}


class RenameBody(BaseModel):
    old_path: str
    new_path: str


@router.post("/rename")
async def rename(body: RenameBody):
    src = resolve(body.old_path)
    dst = resolve(body.new_path)
    if not src.exists():
        raise HTTPException(404, "Source not found")
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), str(dst))
    return {"status": "renamed"}


@router.delete("/delete")
async def delete(path: str):
    full = resolve(path)
    if not full.exists():
        raise HTTPException(404, "Not found")
    if full.is_dir():
        shutil.rmtree(full)
    else:
        full.unlink()
    return {"status": "deleted"}


class CopyBody(BaseModel):
    src: str
    dst: str


@router.post("/copy")
async def copy(body: CopyBody):
    src = resolve(body.src)
    dst = resolve(body.dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    if src.is_dir():
        shutil.copytree(src, dst)
    else:
        shutil.copy2(src, dst)
    return {"status": "copied"}


@router.get("/search")
async def search_files(query: str, workspace: str = "default", max_results: int = 50):
    base = settings.workspace_path / workspace
    results = []
    q = query.lower()
    for root, dirs, files_list in os.walk(base):
        # Skip hidden dirs
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ("node_modules", "__pycache__", ".git", "venv", ".venv")]
        for fname in files_list:
            if q in fname.lower():
                full = Path(root) / fname
                results.append(str(full.relative_to(settings.workspace_path)))
            if len(results) >= max_results:
                return {"results": results}
    return {"results": results}
