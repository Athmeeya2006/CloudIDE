# Cloud IDE

A full-featured, browser-based cloud IDE built with React + FastAPI.

## Architecture

```
.
├── backend/          # FastAPI server (file system, terminal, git)
│   ├── app/
│   │   ├── routers/  # API route handlers
│   │   ├── services/ # Business logic
│   │   └── main.py   # App entry point
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/         # React + TypeScript + Monaco Editor
│   ├── src/
│   │   ├── components/
│   │   ├── stores/   # Zustand state management
│   │   ├── hooks/    # Custom React hooks
│   │   ├── api/      # API client layer
│   │   ├── types/    # TypeScript type definitions
│   │   └── utils/    # Utility functions
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── .github/workflows/  # CI/CD pipelines
```

## Quick Start

### Development (local)

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

### Docker (production-like)

```bash
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React 18, TypeScript, Monaco Editor |
| Styling  | Tailwind CSS 3                      |
| State    | Zustand                             |
| Terminal | xterm.js                            |
| Backend  | FastAPI, Python 3.11                |
| Infra    | Docker, nginx, GitHub Actions       |
| Deploy   | Railway (backend) + Vercel (frontend) |

