from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.routers import files, terminal, processes, database, git

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Cloud IDE backend starting. Workspace: {settings.workspace_path}")
    yield
    logger.info("Shutting down.")


app = FastAPI(
    title="Cloud IDE API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(files.router)
app.include_router(terminal.router)
app.include_router(processes.router)
app.include_router(database.router)
app.include_router(git.router)


@app.get("/health")
async def health():
    return {"status": "ok", "workspace": str(settings.workspace_path)}
