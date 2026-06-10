# Cloud IDE

A full-stack browser-based IDE for running Django, Flask, FastAPI, and general Python projects — with a Monaco editor, interactive terminal, live log streaming, SQLite database viewer, and Git integration.

## Demo

```
Project → Edit files → Run server → See preview → Inspect DB
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
│                                                                   │
│  ┌──────────┐  ┌──────────────────────────┐  ┌────────────────┐ │
│  │ Activity │  │      Editor (Monaco)      │  │    Preview     │ │
│  │   Bar    │  │   Tabs · Syntax · Diff    │  │   (iframe)     │ │
│  └──────────┘  └──────────────────────────┘  └────────────────┘ │
│  ┌──────────┐  ┌──────────────────────────────────────────────┐ │
│  │ Sidebar  │  │            Bottom Panel                       │ │
│  │Explorer  │  │  Terminal(xterm.js) │ Logs │ DB Viewer │Query │ │
│  │ Search   │  └──────────────────────────────────────────────┘ │
│  │   Git    │                                                     │
│  │   DB     │           React + Zustand + Tailwind               │
│  └──────────┘                                                     │
└─────────────────────────────────────────────────────────────────┘
           │ REST /api/*              │ WebSocket
           │ ws://...                 │ /api/terminal/ws/{id}
           ▼                         ▼ /api/processes/{id}/logs
┌──────────────────────────────────────────────────────────────────┐
│                   FastAPI Backend (Python)                         │
│                                                                    │
│  /api/files/*     — CRUD file operations on /workspaces           │
│  /api/terminal/*  — PTY WebSocket (xterm ↔ bash over pty)        │
│  /api/processes/* — spawn & stream stdout/stderr via WebSocket    │
│  /api/database/*  — SQLite viewer (tables, rows, query runner)    │
│  /api/git/*       — clone, status, commit, log                    │
└──────────────────────────────────────────────────────────────────┘
           │
           ▼
  /workspaces/                  ← persistent volume (Docker)
    default/                    ← default workspace
    my-django-project/          ← cloned repos
      manage.py
      db.sqlite3
      ...
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Editor | Monaco Editor (VS Code engine) |
| Terminal | xterm.js + PTY (ptyprocess) over WebSocket |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| State | Zustand |
| Layout | react-resizable-panels |
| Backend | FastAPI, Python 3.11 |
| Real-time | WebSockets (FastAPI native) |
| Database viewer | SQLite3 (Python stdlib) |
| Git | GitPython |
| Container | Docker + docker-compose |

---

## Quick Start

### Option A — Docker Compose (recommended)

```bash
git clone https://github.com/YOUR_USERNAME/cloud-ide
cd cloud-ide
cp backend/.env.example backend/.env
docker compose up --build
```

Open `http://localhost:3000`.

---

### Option B — Local Dev

**Backend:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

---

## Usage

### Creating a project

1. Open the file explorer (top-left `Files` icon)
2. Use `New File` / `New Folder` buttons to scaffold your project
3. Or click the ⎇ icon → **Clone Repository** to pull from GitHub

### Running a server

**Method 1 — Quick Launch (Logs panel)**
1. Click the `Logs` tab in the bottom panel
2. Click `Quick Launch` → pick `Django Dev`, `Flask Run`, etc.

**Method 2 — Terminal**
```bash
cd /workspaces/default
python manage.py runserver 0.0.0.0:8001
```

**Method 3 — Run button**
Click the green `▶ Run` button in the editor toolbar (starts Django dev server by default).

### Viewing your app

- Click `:8001` in the preview port bar at the bottom of the preview panel
- Or click the **👁 Preview** button in the status bar to open the split preview

### Database viewer

After running `python manage.py migrate`, the database appears automatically in:
- **Sidebar → Database** tab (quick access)
- **Bottom panel → Database** tab (full table browser + query runner)

### Git

- **Sidebar → Source Control** — shows changed files, lets you commit
- **Clone dialog** — pulls any public GitHub repo into your workspace

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `WORKSPACE_BASE` | `/workspaces` | Where project files are stored |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | CORS whitelist |
| `MAX_PROCESSES` | `10` | Max concurrent server processes |
| `PORT` | `8000` | Backend port |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `` (empty, uses Vite proxy) | Backend URL in production |
| `VITE_WS_URL` | `ws://localhost:8000` | WebSocket URL for terminal/logs |

---

## Extending to Other Languages

The architecture is language-agnostic. To add Node.js support:

1. Add Node to the backend `Dockerfile`:
   ```dockerfile
   RUN apt-get install -y nodejs npm
   ```
2. Add a Quick Launch preset in `ProcessLogs.tsx`:
   ```tsx
   { label: 'Node Dev', cmd: 'node index.js' },
   { label: 'Next.js',  cmd: 'npm run dev -- --port 8001' },
   ```
3. The terminal and log streaming work identically for any language.

Java, Go, Rust, Ruby — same pattern.

---

## Project Structure

```
cloud-ide/
├── backend/
│   ├── app/
│   │   ├── main.py          ← FastAPI app + CORS + middleware
│   │   ├── config.py        ← Settings (pydantic-settings)
│   │   └── routers/
│   │       ├── files.py     ← CRUD file ops
│   │       ├── terminal.py  ← PTY WebSocket
│   │       ├── processes.py ← Process manager + log WS
│   │       ├── database.py  ← SQLite viewer
│   │       └── git.py       ← Git operations
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ActivityBar/
│   │   │   ├── Sidebar/       ← Explorer, Search, Git, DB
│   │   │   ├── Editor/        ← Monaco + Tabs
│   │   │   ├── BottomPanel/   ← Terminal, Logs, DB viewer
│   │   │   ├── Preview/       ← iframe preview
│   │   │   ├── StatusBar/
│   │   │   ├── Modals/        ← Clone, NewFile
│   │   │   └── Notification/
│   │   ├── stores/            ← Zustand (file, process, ui)
│   │   ├── api/               ← axios client
│   │   ├── types/
│   │   └── utils/
│   └── Dockerfile
├── .github/workflows/
│   └── ci.yml
├── docker-compose.yml
└── README.md
```

---

## License

MIT
