"""Starter app scaffolding.

When a project is created we drop in a tiny, *runnable* full-stack CRUD app so
the whole demo loop works out of the box:

    Run `main.py`  ->  uvicorn on :8000  ->  Live Preview shows the UI  ->
    create/delete items in the UI  ->  rows appear in the Database Viewer.

The app reads ``DATABASE_URL`` from ``.env`` (written here from the project's
provisioned database), so the same code runs against SQLite, Postgres or MySQL.
"""
from __future__ import annotations

from app import provisioning
from app.security import safe_join

_MAIN_PY = '''\
"""Demo CRUD API + UI. Run me with:  python main.py
(The IDE runs this inside your project workspace automatically.)"""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# DATABASE_URL is provisioned for this project (see .env). Defaults to a local
# SQLite file so the app runs even before any database is attached.
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///app.db")
# python-dotenv is pre-installed in the IDE image; load .env if present.
try:
    from dotenv import load_dotenv
    load_dotenv()
    DATABASE_URL = os.environ.get("DATABASE_URL", DATABASE_URL)
except Exception:
    pass

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
Session = sessionmaker(bind=engine)
Base = declarative_base()


class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)


@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(engine)
    yield


app = FastAPI(lifespan=lifespan)


class ItemIn(BaseModel):
    title: str


@app.get("/api/items")
def list_items():
    with Session() as s:
        return [{"id": i.id, "title": i.title} for i in s.query(Item).order_by(Item.id).all()]


@app.post("/api/items")
def add_item(body: ItemIn):
    if not body.title.strip():
        raise HTTPException(400, "Title required")
    with Session() as s:
        item = Item(title=body.title.strip())
        s.add(item)
        s.commit()
        return {"id": item.id, "title": item.title}


@app.delete("/api/items/{item_id}")
def delete_item(item_id: int):
    with Session() as s:
        item = s.get(Item, item_id)
        if item:
            s.delete(item)
            s.commit()
    return {"status": "deleted"}


@app.get("/", response_class=HTMLResponse)
def index():
    return INDEX_HTML


INDEX_HTML = open(os.path.join(os.path.dirname(__file__), "index.html")).read() \\
    if os.path.exists(os.path.join(os.path.dirname(__file__), "index.html")) else "<h1>It works</h1>"


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
'''

_INDEX_HTML = '''\
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Cloud IDE Demo · CRUD</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 540px; margin: 40px auto; color: #222; }
    h1 { font-size: 20px; }
    form { display: flex; gap: 8px; margin: 16px 0; }
    input { flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 6px; }
    button { padding: 8px 14px; border: 0; border-radius: 6px; background: #007acc; color: #fff; cursor: pointer; }
    li { display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid #eee; }
    li button { background: #d9534f; }
    .hint { color: #888; font-size: 13px; }
  </style>
</head>
<body>
  <h1>📋 Items</h1>
  <p class="hint">Add or delete items below, then open the <b>Database Viewer</b> to watch the
  <code>items</code> table update live.</p>
  <form id="f">
    <input id="t" placeholder="New item title" autocomplete="off" />
    <button type="submit">Add</button>
  </form>
  <ul id="list"></ul>
  <script>
    async function load() {
      const r = await fetch('/api/items');
      const items = await r.json();
      document.getElementById('list').innerHTML = items.map(i =>
        `<li><span>#${i.id} ${i.title}</span><button onclick="del(${i.id})">Delete</button></li>`
      ).join('') || '<p class="hint">No items yet.</p>';
    }
    async function del(id) {
      await fetch('/api/items/' + id, { method: 'DELETE' });
      load();
    }
    document.getElementById('f').onsubmit = async (e) => {
      e.preventDefault();
      const t = document.getElementById('t');
      if (!t.value.trim()) return;
      await fetch('/api/items', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: t.value })
      });
      t.value = '';
      load();
    };
    load();
  </script>
</body>
</html>
'''


def _sqlalchemy_url(connection: dict) -> str:
    """Turn provisioning's connection info into a SQLAlchemy URL."""
    engine = connection["engine"]
    if engine == "sqlite":
        # Relative to the project workspace (where the app runs).
        return "sqlite:///app.db"
    if engine == "postgres":
        return connection["url"].replace("postgresql://", "postgresql+psycopg2://", 1)
    if engine == "mysql":
        return connection["url"].replace("mysql://", "mysql+pymysql://", 1)
    return connection["url"]


def scaffold_project(project: dict, db_row: dict | None) -> None:
    """Write starter files into the project's workspace."""
    ws = project["workspace"]
    main_path = safe_join(ws, "main.py")
    main_path.parent.mkdir(parents=True, exist_ok=True)

    main_path.write_text(_MAIN_PY)
    safe_join(ws, "index.html").write_text(_INDEX_HTML)

    db_url = "sqlite:///app.db"
    note = "Default local SQLite database."
    if db_row:
        conn = provisioning.connection_info(db_row, project)
        if db_row["engine"] in ("sqlite", "postgres", "mysql"):
            db_url = _sqlalchemy_url(conn)
        note = f"{db_row['engine']} database provisioned for this project."

    safe_join(ws, ".env").write_text(f"# {note}\nDATABASE_URL={db_url}\n")
    safe_join(ws, "README.md").write_text(
        f"# {project['name']}\n\n"
        "Run the demo app:\n\n"
        "```\npython main.py\n```\n\n"
        "Then open the **Live Preview** (localhost:8000) and add items, and they "
        "appear in the **Database Viewer**.\n\n"
        f"- Database: `{db_url}`\n"
    )
