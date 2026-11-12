FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .
COPY static ./static

RUN mkdir -p /app/data /app/data/photos /app/data/uploads

ENV PORT=3003
ENV DATA_DIR=/app/data
ENV OLLAMA_HOST=http://host.docker.internal:11434

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://127.0.0.1:3003/api/health || exit 1

CMD ["python", "server.py"]
