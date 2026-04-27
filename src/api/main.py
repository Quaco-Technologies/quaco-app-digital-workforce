from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import campaigns, leads, onboarding, pipeline, webhooks
from src.core.config import settings
from src.core.logging import configure_logging, get_logger

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    logger.info("api.startup")

    # Connect to Redis if configured — optional for local dev
    app.state.redis = None
    if settings.redis_url and settings.redis_url.startswith("redis"):
        try:
            from arq import create_pool
            from src.workers.settings import _redis_settings_from_url
            app.state.redis = await create_pool(_redis_settings_from_url(settings.redis_url))
            logger.info("api.redis.connected", url=settings.redis_url)
        except Exception as e:
            logger.warning("api.redis.unavailable", error=str(e))

    yield

    if app.state.redis:
        await app.state.redis.close()
    logger.info("api.shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Digital Workforce",
        description="Autonomous real estate acquisition engine",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(campaigns.router)
    app.include_router(leads.router)
    app.include_router(onboarding.router)
    app.include_router(pipeline.router)
    app.include_router(webhooks.router)

    @app.get("/health", tags=["health"])
    async def health() -> dict:
        redis_ok = app.state.redis is not None
        return {"status": "ok", "version": "0.1.0", "redis": redis_ok}

    return app


app = create_app()
