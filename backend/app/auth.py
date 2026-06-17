"""Email/password authentication.

Kept dependency-free on purpose: password hashing uses PBKDF2-HMAC-SHA256 from
the standard library, and session tokens are compact HMAC-signed blobs (a
JWT-shaped ``payload.signature``) rather than pulling in a JWT library. This
keeps the test environment installable without extra wheels while still being a
real, salted, constant-time-verified auth flow.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time

from fastapi import Depends, Header, HTTPException

from app import metadata

# Signing secret for session tokens. In production this comes from the
# environment; for local/dev we fall back to a per-process random secret, which
# means tokens simply don't survive a restart.
_SECRET = os.environ.get("AUTH_SECRET") or secrets.token_hex(32)
_TOKEN_TTL = 7 * 24 * 3600  # 7 days
_PBKDF2_ROUNDS = 200_000


# --------------------------------------------------------------------------
# Password hashing
# --------------------------------------------------------------------------
def hash_password(password: str) -> str:
    if not password or len(password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ROUNDS)
    return f"pbkdf2_sha256${_PBKDF2_ROUNDS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, rounds, salt_hex, hash_hex = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        dk = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt_hex), int(rounds)
        )
        return hmac.compare_digest(dk.hex(), hash_hex)
    except (ValueError, AttributeError):
        return False


# --------------------------------------------------------------------------
# Tokens
# --------------------------------------------------------------------------
def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _b64d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def create_token(user_id: int, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": int(time.time()) + _TOKEN_TTL}
    body = _b64e(json.dumps(payload, separators=(",", ":")).encode())
    sig = _b64e(hmac.new(_SECRET.encode(), body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"


def decode_token(token: str) -> dict | None:
    try:
        body, sig = token.split(".")
    except ValueError:
        return None
    expected = _b64e(hmac.new(_SECRET.encode(), body.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(sig, expected):
        return None
    try:
        payload = json.loads(_b64d(body))
    except (ValueError, json.JSONDecodeError):
        return None
    if payload.get("exp", 0) < time.time():
        return None
    return payload


# --------------------------------------------------------------------------
# FastAPI dependency
# --------------------------------------------------------------------------
def current_user(authorization: str | None = Header(default=None)) -> dict:
    """Resolve the authenticated user from a ``Bearer`` token, or 401."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Not authenticated")
    payload = decode_token(authorization.split(" ", 1)[1].strip())
    if not payload:
        raise HTTPException(401, "Invalid or expired token")
    user = metadata.get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(401, "User no longer exists")
    return {"id": user["id"], "email": user["email"]}


CurrentUser = Depends(current_user)
