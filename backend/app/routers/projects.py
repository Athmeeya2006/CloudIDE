"""Per-user projects.

A project is the unit a user creates/opens. Each project maps to:
  * a workspace directory (``u<uid>_<slug>``) that all the existing
    file/terminal/process/git routers operate on, and
  * zero or more provisioned databases (see ``provisioning.py``).
"""
from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import metadata, provisioning, scaffold
from app.auth import CurrentUser
from app.security import safe_join

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    slug = slug[:40]
    if not slug:
        raise HTTPException(400, "Project name must contain letters or numbers")
    return slug


def _owned_project(project_id: str, user: dict) -> dict:
    project = metadata.get_project(project_id)
    if not project or project["user_id"] != user["id"]:
        raise HTTPException(404, "Project not found")
    return project


class CreateProject(BaseModel):
    name: str
    engine: str = "sqlite"  # default database engine to provision


@router.get("/")
async def list_my_projects(user: dict = CurrentUser):
    projects = metadata.list_projects(user["id"])
    for p in projects:
        p["databases"] = metadata.list_databases_for_project(p["id"])
    return {"projects": projects}


@router.post("/")
async def create_project(body: CreateProject, user: dict = CurrentUser):
    slug = _slugify(body.name)
    # Reject duplicate slug for this user up front (DB also enforces it).
    if any(p["slug"] == slug for p in metadata.list_projects(user["id"])):
        raise HTTPException(409, "You already have a project with this name")

    project = metadata.create_project(user["id"], body.name.strip(), slug)
    # Materialise the workspace directory so files/terminal work immediately.
    safe_join(project["workspace"]).mkdir(parents=True, exist_ok=True)

    db = None
    if body.engine and body.engine != "none":
        db = provisioning.provision(project, body.engine)
    # Drop in a runnable CRUD starter so the live-preview demo works immediately.
    scaffold.scaffold_project(project, db)
    project["databases"] = metadata.list_databases_for_project(project["id"])
    return {"project": project, "database": db}


@router.get("/engines")
async def available_engines():
    """Which database engines this deployment can actually provision."""
    return {
        "engines": [
            {"id": e, "available": provisioning.engine_available(e)}
            for e in provisioning.SUPPORTED_ENGINES
        ]
    }


@router.get("/{project_id}")
async def get_project(project_id: str, user: dict = CurrentUser):
    project = _owned_project(project_id, user)
    project["databases"] = metadata.list_databases_for_project(project_id)
    return {"project": project}


class AddDatabase(BaseModel):
    engine: str


@router.post("/{project_id}/databases")
async def add_database(project_id: str, body: AddDatabase, user: dict = CurrentUser):
    project = _owned_project(project_id, user)
    db = provisioning.provision(project, body.engine)
    return {
        "database": db,
        "connection": provisioning.connection_info(db, project),
    }


@router.get("/{project_id}/databases")
async def list_project_databases(project_id: str, user: dict = CurrentUser):
    project = _owned_project(project_id, user)
    dbs = metadata.list_databases_for_project(project_id)
    return {
        "databases": [
            {**db, "connection": provisioning.connection_info(db, project)} for db in dbs
        ]
    }


@router.delete("/{project_id}")
async def delete_project(project_id: str, user: dict = CurrentUser):
    _owned_project(project_id, user)
    for db in metadata.list_databases_for_project(project_id):
        provisioning.deprovision(db)
    metadata.delete_project(project_id)
    return {"status": "deleted"}
