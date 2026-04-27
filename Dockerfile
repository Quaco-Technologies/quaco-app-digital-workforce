FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir anthropic fastapi "uvicorn[standard]" httpx supabase \
    apify-client python-dotenv pydantic pydantic-settings reportlab arq redis \
    structlog "python-jose[cryptography]"

COPY src/ ./src/
COPY main.py .

EXPOSE 8000
CMD ["python", "main.py"]
