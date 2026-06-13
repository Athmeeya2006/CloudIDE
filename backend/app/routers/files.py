import mimetypes
import os
import shutil
from pathlib import Path

import aiofiles
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.security import SKIP_DIRS, safe_join, safe_workspace, workspace_root

router = APIRouter(prefix="/api/files", tags=["files"])

BINARY_EXTS = frozenset({
    "jpg", "jpeg", "png", "gif", "ico", "svg", "webp", "bmp", "tiff",
    "woff", "woff2", "ttf", "eot", "otf",
    "db", "sqlite", "sqlite3",
    "zip", "tar", "gz", "bz2", "7z", "rar",
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "exe", "dll", "so", "dylib", "bin", "o", "a",
    "mp3", "mp4", "wav", "avi", "mov", "mkv",
    "pyc", "pyo", "class",
})

# Guard rails so a pathological workspace can never produce an unbounded tree
# or read an enormous file into memory.
MAX_TREE_NODES = 10_000
MAX_TREE_DEPTH = 32
MAX_READ_BYTES = 5 * 1024 * 1024  # 5 MB


def resolve(path: str) -> Path:
    """Resolve a workspace-relative path, rejecting traversal."""
    return safe_join(path)


def node(p: Path, base: Path, depth: int = 0, counter: list[int] | None = None) -> dict:
    if counter is None:
        counter = [0]
    rel = str(p.relative_to(base))
    try:
        st = p.stat()
    except OSError:
        st = None

    if p.is_dir():
        children: list[dict] = []
        if depth < MAX_TREE_DEPTH:
            try:
                entries = sorted(
                    p.iterdir(),
                    key=lambda x: (x.is_file(), x.name.lower()),
                )
            except OSError:
                entries = []
            for c in entries:
                if counter[0] >= MAX_TREE_NODES:
                    break
                # Never descend into heavy / machine-generated directories.
                if c.is_dir() and c.name in SKIP_DIRS:
                    continue
                counter[0] += 1
                children.append(node(c, base, depth + 1, counter))
        return {
            "name": p.name,
            "path": rel,
            "type": "directory",
            "children": children,
        }
    return {
        "name": p.name,
        "path": rel,
        "type": "file",
        "size": st.st_size if st else 0,
        "modified": st.st_mtime if st else 0,
    }


@router.get("/tree")
async def get_tree(workspace: str = "default"):
    ws = safe_workspace(workspace)
    base = workspace_root() / ws
    base.mkdir(parents=True, exist_ok=True)
    return node(base, workspace_root())


class WriteBody(BaseModel):
    path: str
    content: str


@router.post("/write")
async def write_file(body: WriteBody):
    full = resolve(body.path)
    if full.is_dir():
        raise HTTPException(400, "Path is a directory")
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
        if full.stat().st_size > MAX_READ_BYTES:
            return {
                "path": path,
                "content": "",
                "encoding": "binary",
                "error": "File too large to display (over 5 MB)",
            }
    except OSError:
        raise HTTPException(404, "File not found")
    try:
        async with aiofiles.open(full, "r", encoding="utf-8") as f:
            content = await f.read()
        return {"path": path, "content": content, "encoding": "utf-8"}
    except UnicodeDecodeError:
        return {"path": path, "content": "", "encoding": "binary", "error": "Binary file: cannot display"}


@router.get("/raw/{full_path:path}")
async def raw_file(full_path: str):
    """Serve a workspace file verbatim with a guessed content type.

    The URL path mirrors the file path, so an HTML page served here can use
    ordinary relative links (``style.css``, ``js/app.js``) and they resolve
    correctly — which is what makes the static "Preview" of an index.html work
    without running a server.
    """
    target = safe_join(full_path)
    if not target.exists() or target.is_dir():
        raise HTTPException(404, "Not found")
    media, _ = mimetypes.guess_type(target.name)
    return FileResponse(
        target,
        media_type=media or "application/octet-stream",
        headers={"Cache-Control": "no-cache"},
    )


@router.post("/upload")
async def upload_files(
    files: list[UploadFile] = File(...),
    workspace: str = Form("default"),
    dest: str = Form(""),
):
    """Upload one or more files (or a whole folder) from the user's computer.

    For folder uploads the browser sends each file's relative path as its
    filename (via ``webkitRelativePath``), so the directory structure is
    recreated under ``dest``.
    """
    ws = safe_workspace(workspace)
    base = safe_join(ws, dest)  # target directory, validated inside the root
    base_resolved = base.resolve()
    written = []
    for f in files:
        rel = (f.filename or "").replace("\x00", "").lstrip("/")
        if not rel:
            continue
        target = (base / rel).resolve()
        # Each uploaded file must stay within the target directory.
        try:
            target.relative_to(base_resolved)
        except ValueError:
            raise HTTPException(403, "Access denied")
        if target.is_dir():
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        async with aiofiles.open(target, "wb") as out:
            while True:
                chunk = await f.read(1024 * 1024)
                if not chunk:
                    break
                await out.write(chunk)
        await f.close()
        written.append(str(target.relative_to(workspace_root())))
    if not written:
        raise HTTPException(400, "No files uploaded")
    return {"status": "uploaded", "count": len(written), "files": written}


class CreateBody(BaseModel):
    path: str
    is_dir: bool = False


@router.post("/create")
async def create(body: CreateBody):
    full = resolve(body.path)
    if full.exists():
        raise HTTPException(409, "Path already exists")
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
    if dst.exists():
        raise HTTPException(409, "Destination already exists")
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), str(dst))
    return {"status": "renamed"}


@router.delete("/delete")
async def delete(path: str):
    full = resolve(path)
    if full == workspace_root():
        raise HTTPException(400, "Cannot delete the workspace root")
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
    if not src.exists():
        raise HTTPException(404, "Source not found")
    if dst.exists():
        raise HTTPException(409, "Destination already exists")
    dst.parent.mkdir(parents=True, exist_ok=True)
    if src.is_dir():
        shutil.copytree(src, dst)
    else:
        shutil.copy2(src, dst)
    return {"status": "copied"}


@router.get("/search")
async def search_files(query: str, workspace: str = "default", max_results: int = 50):
    """Search by filename."""
    ws = safe_workspace(workspace)
    base = workspace_root() / ws
    max_results = max(1, min(max_results, 500))
    results = []
    q = query.lower()
    for root, dirs, files_list in os.walk(base):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in SKIP_DIRS]
        for fname in files_list:
            if q in fname.lower():
                full = Path(root) / fname
                results.append(str(full.relative_to(workspace_root())))
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

    ws = safe_workspace(workspace)
    base = workspace_root() / ws
    max_results = max(1, min(max_results, 2000))
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
                            rel_path = str(full.relative_to(workspace_root()))
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
    base = workspace_root()
    try:
        dirs = [d.name for d in base.iterdir() if d.is_dir() and not d.name.startswith(".")]
        if "default" not in dirs:
            dirs.insert(0, "default")
        return {"workspaces": sorted(dirs, key=lambda x: (x != "default", x.lower()))}
    except OSError:
        return {"workspaces": ["default"]}


@router.post("/workspaces")
async def create_workspace(body: CreateWorkspaceBody):
    name = safe_workspace(body.name)
    full = workspace_root() / name
    full.mkdir(parents=True, exist_ok=True)
    return {"status": "created", "workspace": name}
