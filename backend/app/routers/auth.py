"""Email/password registration & login."""
from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import auth, metadata
from app.auth import CurrentUser

router = APIRouter(prefix="/api/auth", tags=["auth"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class Credentials(BaseModel):
    email: str
    password: str


def _normalise_email(email: str) -> str:
    email = (email or "").strip().lower()
    if not _EMAIL_RE.match(email):
        raise HTTPException(400, "Invalid email address")
    return email


@router.post("/register")
async def register(body: Credentials):
    email = _normalise_email(body.email)
    if metadata.get_user_by_email(email):
        raise HTTPException(409, "An account with this email already exists")
    pw_hash = auth.hash_password(body.password)
    user = metadata.create_user(email, pw_hash)
    token = auth.create_token(user["id"], user["email"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"]}}


@router.post("/login")
async def login(body: Credentials):
    email = _normalise_email(body.email)
    user = metadata.get_user_by_email(email)
    if not user or not auth.verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    token = auth.create_token(user["id"], user["email"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"]}}


@router.get("/me")
async def me(user: dict = CurrentUser):
    return {"user": user}
