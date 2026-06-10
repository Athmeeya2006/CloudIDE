FROM python:3.11-slim

# Install system deps for PTY + git
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    bash \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Add group/user and configure permissions
RUN groupadd -g 1000 ide && \
    useradd -u 1000 -g ide -s /bin/bash -m ide && \
    mkdir -p /workspaces/default /app && \
    chown -R ide:ide /workspaces /app

WORKDIR /app

# Install Python deps for common project types
RUN pip install --no-cache-dir \
    django \
    flask \
    fastapi \
    uvicorn \
    requests \
    sqlalchemy \
    psycopg2-binary \
    python-dotenv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=ide:ide . .

USER ide

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
