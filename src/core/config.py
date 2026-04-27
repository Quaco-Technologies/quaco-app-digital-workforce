from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Anthropic (kept for legacy agents)
    anthropic_api_key: str = ""
    model: str = "claude-sonnet-4-6"

    # OpenAI — browser agent + vision steps
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    # Browserbase — cloud browser sessions
    browserbase_api_key: str = ""
    browserbase_project_id: str = ""

    # Firecrawl — scraping + extraction
    firecrawl_api_key: str = ""

    # Supabase
    supabase_url: str
    supabase_key: str
    supabase_jwt_secret: str = ""

    # Apify
    apify_token: str

    # Telenyx
    telenyx_api_key: str
    telenyx_from_number: str
    telenyx_webhook_secret: str = ""

    # Lumin
    lumin_api_key: str
    lumin_base_url: str = "https://api.luminpdf.com/v1"

    # Redis (for ARQ job queue)
    redis_url: str = "redis://localhost:6379"


settings = Settings()
