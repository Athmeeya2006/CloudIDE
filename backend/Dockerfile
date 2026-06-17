FROM python:3.11-slim

# Install system deps for PTY + git, plus the language runtimes user projects
# need pre-installed (sudo, Node.js + npm, build tools). The whole point of the
# IDE image is that a user never has to install node/npm/python themselves.
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    bash \
    curl \
    sudo \
    ca-certificates \
    gnupg \
    build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g npm@latest \
    && rm -rf /var/lib/apt/lists/*

# Add group/user and configure permissions
RUN groupadd -g 1000 ide && \
    useradd -u 1000 -g ide -s /bin/bash -m ide && \
    mkdir -p /workspaces/default /app && \
    chown -R ide:ide /workspaces /app

WORKDIR /app

# Install Python deps for common project types, pre-installed so user projects
# (FastAPI / Flask / Django apps) run without any manual pip install.
RUN pip install --no-cache-dir \
    flask \
    fastapi \
    uvicorn \
    django \
    requests \
    sqlalchemy \
    psycopg2-binary \
    PyMySQL \
    pymongo \
    python-dotenv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=ide:ide . .

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
