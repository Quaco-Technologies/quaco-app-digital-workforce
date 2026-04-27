FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
RUN pip install --no-cache-dir \
    anthropic fastapi "uvicorn[standard]" httpx supabase \
    apify-client python-dotenv pydantic pydantic-settings reportlab arq redis \
    structlog "python-jose[cryptography]" \
    openai firecrawl-py

COPY src/ ./src/
COPY main.py .

EXPOSE 8000
CMD ["python", "main.py"]
