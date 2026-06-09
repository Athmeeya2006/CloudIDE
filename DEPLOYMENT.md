# Deployment Guide

## Overview

| Service | Platform | Cost | Notes |
|---|---|---|---|
| Backend (FastAPI + PTY) | Railway | Free/$5/mo | Needs persistent volume for workspaces |
| Frontend (React) | Vercel | Free | Static deploy |

> **Why not serverless?** The backend needs PTY (pseudo-terminal), persistent WebSocket connections, and long-running processes. Serverless platforms (Lambda, Vercel Functions) don't support any of these. Railway/Render/Fly.io are the right choice.

---

## Step 1 — Deploy Backend to Railway

1. Go to [railway.app](https://railway.app) and sign up (free)

2. Create a new project → **Deploy from GitHub repo**

3. Select your `cloud-ide` repository

4. Railway auto-detects the `backend/Dockerfile`. If not, set **Root Directory** to `backend`

5. Add environment variables in Railway dashboard:
   ```
   WORKSPACE_BASE=/workspaces
   ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
   PORT=8000
   ```

6. Add a **Persistent Volume**:
   - In Railway dashboard → your service → **Volumes**
   - Mount path: `/workspaces`
   - This keeps workspace files across deploys

7. Note your Railway public URL: `https://cloud-ide-backend-xxxx.railway.app`

---

## Step 2 — Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub

2. Set **Root Directory** to `frontend`

3. Set build settings:
   - Framework: Vite
   - Build command: `npm run build`
   - Output directory: `dist`

4. Add environment variables:
   ```
   VITE_API_URL=https://cloud-ide-backend-xxxx.railway.app
   VITE_WS_URL=wss://cloud-ide-backend-xxxx.railway.app
   ```
   > Note: `wss://` not `ws://` for production HTTPS

5. Deploy → note your Vercel URL: `https://cloud-ide-xxxx.vercel.app`

6. Go back to Railway → update `ALLOWED_ORIGINS` to your Vercel URL

---

## Step 3 — Wire up GitHub Actions

Add these secrets to your GitHub repo (Settings → Secrets → Actions):

| Secret | Value |
|---|---|
| `RAILWAY_TOKEN` | From Railway dashboard → Account → Tokens |
| `BACKEND_URL` | `https://cloud-ide-backend-xxxx.railway.app` |
| `BACKEND_WS_URL` | `wss://cloud-ide-backend-xxxx.railway.app` |
| `VERCEL_TOKEN` | From Vercel → Account → Tokens |
| `VERCEL_ORG_ID` | From `vercel link` output or Vercel team settings |
| `VERCEL_PROJECT_ID` | From `vercel link` output or project settings |

After this, every push to `main` auto-deploys both services.

---

## Alternative: Render

If Railway doesn't work, use [render.com](https://render.com):

**Backend (Web Service):**
- Environment: Docker
- Root directory: `backend`
- Add disk: mount at `/workspaces`, 1GB

**Frontend (Static Site):**
- Root directory: `frontend`
- Build: `npm install && npm run build`
- Publish directory: `dist`

---

## Alternative: Fly.io (best for performance)

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Backend
cd backend
fly launch --name cloud-ide-backend
fly volumes create workspaces --size 5
# Add [mounts] section to fly.toml: source = "workspaces", destination = "/workspaces"
fly deploy

# Frontend
cd frontend
# Set VITE_API_URL and VITE_WS_URL in .env.production
npm run build
fly launch --name cloud-ide-frontend
```

---

## Security Checklist for Production

- [ ] Set a random `SECRET_KEY` environment variable
- [ ] Add authentication (the current MVP has no auth — anyone with the URL can access your files)
- [ ] Limit `ALLOWED_ORIGINS` to your exact frontend domain
- [ ] Consider running workspace code in Docker containers for isolation (not the same container as the API)
- [ ] Rate-limit the process spawn endpoint
- [ ] Use HTTPS everywhere (`wss://` not `ws://`)
