"""Project run configuration for the one-click "Run dev servers" action.

A project may include a ``cloudide.json`` at its workspace root that lists the
services to start:

    {
      "services": [
        {
          "name": "backend",
          "command": "uvicorn main:app --host 0.0.0.0 --port 5000 --reload",
          "cwd": "backend",
          "port": 5000
        },
        {
          "name": "frontend",
          "command": "npm run dev -- --host --port 5173",
          "cwd": "frontend",
          "port": 5173
        }
      ]
    }

When that file is absent, ``detect_services`` inspects the workspace root and its
immediate subdirectories for common project markers (``package.json``,
``manage.py``, ``main.py``/``app.py``) and proposes sensible commands. The
config, when present, always wins.
"""
from __future__ import annotations

import json
from pathlib import Path

from app.config import settings
from app.security import SKIP_DIRS, safe_join

CONFIG_NAME = "cloudide.json"

# Ports we hand out to detected services. We avoid 8000 (IDE backend) and 3000
# (IDE frontend) on purpose.
_FRONTEND_PORTS = [5173, 5174, 5175, 5176]
_BACKEND_PORTS = [5000, 5001, 5002, 5003]
_COMPOSE_FILES = ("docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml")


def get_services(workspace: str) -> dict:
    """Return the services to run for a project, with their source."""
    configured = _read_config(workspace)
    if configured is not None:
        return {"services": configured, "source": "config"}
    return {"services": detect_services(workspace), "source": "detected"}


def save_config(workspace: str, services: list[dict]) -> str:
    """Write ``services`` to the project's ``cloudide.json`` and return its path."""
    clean = []
    for s in services:
        if not isinstance(s, dict) or not str(s.get("command", "")).strip():
            continue
        entry = {
            "name": str(s.get("name") or "service"),
            "command": str(s["command"]).strip(),
            "cwd": str(s.get("cwd") or "").strip("/"),
        }
        if isinstance(s.get("port"), int):
            entry["port"] = s["port"]
        clean.append(entry)

    path = safe_join(workspace, CONFIG_NAME)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({"services": clean}, indent=2) + "\n", encoding="utf-8"
    )
    return f"{workspace}/{CONFIG_NAME}"


def _read_config(workspace: str) -> list[dict] | None:
    path = safe_join(workspace, CONFIG_NAME)
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        return None
    raw = data.get("services") if isinstance(data, dict) else None
    if not isinstance(raw, list):
        return None
    services = []
    for s in raw:
        if not isinstance(s, dict) or not str(s.get("command", "")).strip():
            continue
        services.append({
            "name": str(s.get("name") or "service"),
            "command": str(s["command"]).strip(),
            "cwd": str(s.get("cwd") or "").strip("/"),
            "port": s.get("port") if isinstance(s.get("port"), int) else None,
        })
    return services or None


def detect_services(workspace: str) -> list[dict]:
    root = safe_join(workspace)
    if not root.is_dir():
        return []

    # Docker Compose at the project root runs the whole stack and owns its own
    # ports, so it takes over and we do not also detect individual services.
    compose = next((root / n for n in _COMPOSE_FILES if (root / n).is_file()), None)
    if compose:
        return [{
            "name": "docker compose",
            "command": f"docker compose -f {compose.name} up --build",
            "cwd": "",
            "port": None,
        }]

    # The workspace root plus its immediate, meaningful subdirectories.
    search_dirs = [(root, "")]
    try:
        for child in sorted(root.iterdir()):
            if child.is_dir() and child.name not in SKIP_DIRS and not child.name.startswith("."):
                search_dirs.append((child, child.name))
    except OSError:
        pass

    services: list[dict] = []
    ports = {"backend": list(_BACKEND_PORTS), "frontend": list(_FRONTEND_PORTS)}
    for directory, rel in search_dirs:
        for svc in _detect_in_dir(directory, rel):
            kind = svc.pop("kind", None)
            if kind in ports and ports[kind]:
                svc["port"] = ports[kind].pop(0)
            if svc.get("port") and "{port}" in svc["command"]:
                svc["command"] = svc["command"].format(port=svc["port"])
            services.append(svc)
    return services


# Python entrypoints we recognise, in priority order.
_PY_ENTRYPOINTS = (
    "main.py", "app.py", "server.py", "run.py",
    "manage.py", "wsgi.py", "asgi.py", "application.py",
)
# Node entrypoints to run directly when there is no package.json dev script.
_NODE_ENTRYPOINTS = ("server.js", "index.js", "app.js", "server.mjs", "index.mjs")


def _detect_in_dir(d: Path, rel: str) -> list[dict]:
    out: list[dict] = []
    label = rel or "app"

    # --- Node / frontend ---
    pkg = d / "package.json"
    if pkg.is_file():
        cmd = _node_command(pkg)
        if cmd:
            out.append({
                "name": rel or "frontend",
                "command": cmd,
                "cwd": rel,
                "port": None,
                "kind": "frontend",
            })
    else:
        for entry in _NODE_ENTRYPOINTS:
            if (d / entry).is_file():
                out.append({
                    "name": f"{label}-node",
                    # Many Node apps read PORT from the environment.
                    "command": f"PORT={{port}} node {entry}",
                    "cwd": rel,
                    "port": None,
                    "kind": "backend",
                })
                break

    # --- Python ---
    py = _find_python_entry(d)
    if py:
        if py.name == "manage.py":
            out.append({
                "name": f"{label}-django",
                "command": "python manage.py runserver 0.0.0.0:{port}",
                "cwd": rel,
                "port": None,
                "kind": "backend",
            })
        else:
            module = py.stem
            command, kind = _python_command(py, module)
            out.append({
                "name": rel or "backend",
                "command": command,
                "cwd": rel,
                "kind": kind,
                "port": None,
            })

    # --- Dockerfile (only if this dir produced nothing else) ---
    if not out and (d / "Dockerfile").is_file():
        port = _dockerfile_port(d / "Dockerfile")
        image = f"cloudide_{(rel or 'app').replace('/', '_')}".lower()
        run = f"docker run --rm -p {port}:{port} {image}" if port else f"docker run --rm {image}"
        out.append({
            "name": f"{label}-docker",
            "command": f"docker build -t {image} . && {run}",
            "cwd": rel,
            "port": port,
            "kind": "fixed" if port else None,
        })

    return out


def _find_python_entry(d: Path) -> Path | None:
    for name in _PY_ENTRYPOINTS:
        if (d / name).is_file():
            return d / name
    # Fall back to a lone .py file at this level (a simple script project).
    try:
        py_files = [p for p in d.iterdir() if p.is_file() and p.suffix == ".py"]
    except OSError:
        py_files = []
    if len(py_files) == 1:
        return py_files[0]
    return None


def low_memory_mode() -> bool:
    """Whether to prefer production build-and-serve over heavy dev servers.

    Enabled explicitly via ``LOW_MEMORY``, or auto-enabled on hosts with less
    than ~1 GiB of RAM (a CRA/webpack dev server alone can exceed that and get
    OOM-killed).
    """
    if settings.low_memory:
        return True
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemTotal:"):
                    return int(line.split()[1]) < 1024 * 1024  # kB < 1 GiB
    except (OSError, ValueError, IndexError):
        pass
    return False


def _node_command(pkg: Path) -> str | None:
    """Build a Node command that binds 0.0.0.0 on a deterministic ``{port}``.

    Forcing host and port is what makes the preview reliable: otherwise Vite,
    Next, CRA, etc. each pick their own default and bind to localhost, so the
    preview and the app disagree on where to look.

    In low-memory mode, known frameworks are built once and served from the
    static output instead of running a memory-heavy dev server.
    """
    try:
        data = json.loads(pkg.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        data = {}
    scripts = data.get("scripts", {})
    deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
    has_build = "build" in scripts
    low_mem = low_memory_mode()

    if "dev" in scripts:
        run = "npm run dev"
    elif "start" in scripts:
        run = "npm start"
    elif "vite" in deps:
        run = "npx --yes vite"
    else:
        return None

    cmd: str | None = None

    # The preview is served under a path prefix (/api/preview/<port>/), so the
    # app must emit its asset/module URLs with that base, or a single-page app's
    # absolute imports resolve to the wrong place and the page renders blank.
    base = "/api/preview/{port}/"

    # Low-memory: build the app once and serve the static output. Far lighter at
    # runtime than a dev server (no webpack/HMR held in memory).
    if low_mem and has_build:
        if "next" in deps:
            cmd = "npm run build && npm run start -- -p {port} -H 0.0.0.0"
        elif "vite" in deps:
            cmd = (
                f"npm run build -- --base {base} && "
                f"npx --yes vite preview --base {base} --host 0.0.0.0 --port {{port}}"
            )
        elif "react-scripts" in deps:
            cmd = (
                "GENERATE_SOURCEMAP=false NODE_OPTIONS=--max-old-space-size=512 "
                f"PUBLIC_URL={base} npm run build && npx --yes serve -s build -l {{port}}"
            )

    # Default: run the framework's dev server with forced host/port + base.
    if cmd is None:
        if "next" in deps:
            cmd = f"{run} -- -p {{port}} -H 0.0.0.0"
        elif "react-scripts" in deps:
            # GENERATE_SOURCEMAP=false and a capped Node heap cut the memory the
            # CRA/webpack dev server uses, which is what gets it OOM-killed.
            cmd = (
                "GENERATE_SOURCEMAP=false NODE_OPTIONS=--max-old-space-size=512 "
                f"PUBLIC_URL={base} HOST=0.0.0.0 PORT={{port}} BROWSER=none {run}"
            )
        elif "vite" in deps:
            cmd = f"{run} -- --host 0.0.0.0 --port {{port}} --base {base}"
        else:
            # Vue/Svelte/Angular and unknown toolchains: common flags pass
            # through and are harmless if ignored.
            cmd = f"{run} -- --host 0.0.0.0 --port {{port}}"

    # --legacy-peer-deps so peer-dependency conflicts (common in older React
    # libraries) never block the install; --no-audit/--no-fund cut noise and time.
    install = "npm install --legacy-peer-deps --no-audit --no-fund && "
    prefix = "" if (pkg.parent / "node_modules").is_dir() else install
    return f"{prefix}{cmd}"


def _dockerfile_port(dockerfile: Path) -> int | None:
    try:
        for line in dockerfile.read_text(encoding="utf-8", errors="replace").splitlines():
            stripped = line.strip()
            if stripped.upper().startswith("EXPOSE"):
                parts = stripped.split()
                if len(parts) > 1 and parts[1].split("/")[0].isdigit():
                    return int(parts[1].split("/")[0])
    except OSError:
        pass
    return None


def _python_command(entry: Path, module: str) -> tuple[str, str]:
    """Choose uvicorn / flask / plain python based on the file's contents.

    Returns ``(command, kind)`` where kind is ``backend`` for servers (which get
    a port assigned) or ``script`` for plain programs (which do not).
    """
    try:
        text = entry.read_text(encoding="utf-8", errors="replace")
    except OSError:
        text = ""
    if "FastAPI(" in text or "from fastapi" in text:
        return f"uvicorn {module}:app --host 0.0.0.0 --port {{port}} --reload", "backend"
    if "Flask(" in text or "from flask" in text:
        return f"flask --app {module} run --host 0.0.0.0 --port {{port}}", "backend"
    return f"python -u {entry.name}", "script"
