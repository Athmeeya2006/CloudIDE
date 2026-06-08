FROM python:3.11-slim

# Install system deps for PTY + git
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    bash \
    curl \
    build-essential \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

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

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /workspaces/default

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
