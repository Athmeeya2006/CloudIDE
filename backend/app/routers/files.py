import os
import shutil
from pathlib import Path
import aiofiles
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/api/files", tags=["files"])

SKIP_DIRS = frozenset({"node_modules", "__pycache__", ".git", "venv", ".venv", "dist", ".next", "build", ".cache"})
BINARY_EXTS = frozenset({
    "jpg","jpeg","png","gif","ico","svg","webp","bmp","tiff",
    "woff","woff2","ttf","eot","otf",
    "db","sqlite","sqlite3",
    "zip","tar","gz","bz2","7z","rar",
    "pdf","doc","docx","xls","xlsx","ppt","pptx",
    "exe","dll","so","dylib","bin","o","a",
    "mp3","mp4","wav","avi","mov","mkv",
    "pyc","pyo","class",
})


def resolve(path: str) -> Path:
    base = settings.workspace_path.resolve()
    clean = path.replace('\x00', '').lstrip('/')
    if '..' in clean.split('/'):
        raise HTTPException(403, "Access denied")
    resolved = (base / clean).resolve()
    try:
        resolved.relative_to(base)
    except ValueError:
        raise HTTPException(403, "Access denied")
    return resolved


def node(p: Path, base: Path) -> dict:
    rel = str(p.relative_to(base))
    if p.is_dir():
        try:
            children = sorted(p.iterdir(), key=lambda x: (x.is_file(), x.name.lower()))
        except PermissionError:
            children = []
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
    return {"status": "saved", "path": body.path, "size": len(body.content.encode())}


@router.get("/read")
async def read_file(path: str):
    full = resolve(path)
    if not full.exists():
        raise HTTPException(404, "File not found")
    if full.is_dir():
        raise HTTPException(400, "Path is a directory")
    try:
        async with aiofiles.open(full, "r", encoding="utf-8") as f:
            content = await f.read()
        return {"path": path, "content": content, "encoding": "utf-8"}
    except UnicodeDecodeError:
        return {"path": path, "content": "", "encoding": "binary", "error": "Binary file: cannot display"}


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
    """Search by filename."""
    base = settings.workspace_path / workspace
    results = []
    q = query.lower()
    for root, dirs, files_list in os.walk(base):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in SKIP_DIRS]
        for fname in files_list:
            if q in fname.lower():
                full = Path(root) / fname
                results.append(str(full.relative_to(settings.workspace_path)))
            if len(results) >= max_results:
                return {"results": results}
    return {"results": results}


@router.get("/grep")
async def grep_files(
    query: str,
    workspace: str = "default",
    max_results: int = 200,
    case_sensitive: bool = False,
):
    """Search file contents. Returns matched lines with path and line number."""
    if not query or len(query) < 1:
        raise HTTPException(400, "Query too short")
    if len(query) > 200:
        raise HTTPException(400, "Query too long")

    base = settings.workspace_path / workspace
    results = []
    search_q = query if case_sensitive else query.lower()
    truncated = False

    for root, dirs, files_list in os.walk(base):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in SKIP_DIRS]
        for fname in files_list:
            ext = fname.rsplit('.', 1)[-1].lower() if '.' in fname else ''
            if ext in BINARY_EXTS:
                continue

            full = Path(root) / fname
            try:
                file_size = full.stat().st_size
            except OSError:
                continue

            if file_size > 2_000_000:  # Skip files > 2MB
                continue

            try:
                with open(full, 'r', encoding='utf-8', errors='replace') as f:
                    for line_num, line in enumerate(f, 1):
                        check = line if case_sensitive else line.lower()
                        if search_q in check:
                            rel_path = str(full.relative_to(settings.workspace_path))
                            results.append({
                                "path": rel_path,
                                "name": fname,
                                "line": line_num,
                                "content": line.rstrip()[:300],  # cap line length
                            })
                            if len(results) >= max_results:
                                truncated = True
                                break
                if truncated:
                    break
            except (OSError, PermissionError):
                continue
        if truncated:
            break

    return {"results": results, "truncated": truncated, "count": len(results)}


class CreateWorkspaceBody(BaseModel):
    name: str


@router.get("/workspaces")
async def get_workspaces():
    base = settings.workspace_path.resolve()
    try:
        dirs = [d.name for d in base.iterdir() if d.is_dir() and not d.name.startswith(".")]
        if "default" not in dirs:
            dirs.insert(0, "default")
        return {"workspaces": sorted(dirs, key=lambda x: (x != "default", x.lower()))}
    except Exception:
        return {"workspaces": ["default"]}


@router.post("/workspaces")
async def create_workspace(body: CreateWorkspaceBody):
    name = body.name.replace('\x00', '').strip()
    if not name or '..' in name.split('/') or '/' in name:
        raise HTTPException(400, "Invalid workspace name")
    full = settings.workspace_path / name
    full.mkdir(parents=True, exist_ok=True)
    return {"status": "created", "workspace": name}
