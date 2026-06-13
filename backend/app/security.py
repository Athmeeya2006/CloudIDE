"""Shared filesystem-safety helpers.

All user-supplied paths and workspace names flow through here so that path
traversal (``../``), null-byte injection, and escapes via symlinks are rejected
consistently across every router.
"""
from pathlib import Path

from fastapi import HTTPException

from app.config import settings

# Directories that are never useful to walk into (huge, machine-generated, or
# internal VCS state). Shared by the tree, search, grep and database scanners.
SKIP_DIRS = frozenset({
    "node_modules", "__pycache__", ".git", "venv", ".venv", "env", ".env.d",
    "dist", ".next", "build", ".cache", ".pytest_cache", ".ruff_cache",
    ".mypy_cache", ".gradle", "target", ".idea", ".vscode", "__MACOSX",
})


def workspace_root() -> Path:
    """Absolute, symlink-resolved root that everything must stay inside."""
    return settings.workspace_path.resolve()


def safe_workspace(name: str | None) -> str:
    """Validate a workspace *name* (a single path segment).

    Returns the cleaned name or raises 400. ``None``/empty defaults to
    ``"default"`` so callers can rely on always getting a usable value.
    """
    name = (name or "default").replace("\x00", "").strip()
    if not name:
        return "default"
    if (
        "/" in name
        or "\\" in name
        or name in (".", "..")
        or name.startswith(".")
    ):
        raise HTTPException(400, "Invalid workspace name")
    return name


def safe_join(*parts: str) -> Path:
    """Join ``parts`` under the workspace root, rejecting any traversal.

    The returned path is guaranteed (after resolving symlinks) to live inside
    the workspace root. Raises 403 otherwise.
    """
    root = workspace_root()
    rel_parts = []
    for part in parts:
        cleaned = (part or "").replace("\x00", "").lstrip("/")
        if cleaned:
            rel_parts.append(cleaned)
    rel = "/".join(rel_parts)
    target = (root / rel).resolve()
    try:
        target.relative_to(root)
    except ValueError:
        raise HTTPException(403, "Access denied")
    return target


def safe_workspace_dir(name: str | None) -> Path:
    """Resolve and ensure a workspace directory, validating its name."""
    ws = safe_workspace(name)
    return safe_join(ws)
