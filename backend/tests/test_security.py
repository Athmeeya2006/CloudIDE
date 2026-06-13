"""Unit tests for the shared path-safety helpers."""
import pytest
from fastapi import HTTPException

from app import security


def test_safe_workspace_defaults():
    assert security.safe_workspace(None) == "default"
    assert security.safe_workspace("") == "default"
    assert security.safe_workspace("  ") == "default"
    assert security.safe_workspace("myproject") == "myproject"


@pytest.mark.parametrize("bad", ["../etc", "a/b", "..", ".", ".hidden", "a\\b", "x\x00y" + "/.."])
def test_safe_workspace_rejects_bad(bad):
    with pytest.raises(HTTPException) as exc:
        security.safe_workspace(bad)
    assert exc.value.status_code in (400, 403)


def test_safe_join_stays_in_root(tmp_path):
    p = security.safe_join("default", "sub", "file.txt")
    assert p.is_relative_to(security.workspace_root())


@pytest.mark.parametrize("evil", ["../../etc/passwd", "..", "default/../../secret", "/etc/passwd"])
def test_safe_join_blocks_traversal(evil):
    # "/etc/passwd" -> lstrip('/') -> "etc/passwd" stays inside, but the
    # explicit traversal variants must escape and be rejected.
    if evil == "/etc/passwd":
        p = security.safe_join(evil)
        assert p.is_relative_to(security.workspace_root())
        return
    with pytest.raises(HTTPException) as exc:
        security.safe_join(evil)
    assert exc.value.status_code == 403


def test_safe_join_strips_null_bytes():
    p = security.safe_join("default/foo\x00.txt")
    assert "\x00" not in str(p)
