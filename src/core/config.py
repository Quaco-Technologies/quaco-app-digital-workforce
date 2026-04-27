from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Anthropic (used by contract/negotiation agents)
    anthropic_api_key: str = ""
    model: str = "claude-sonnet-4-6"

    # OpenAI — county scraper agent, photo vision, comps parsing
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    # Supabase
    supabase_url: str
    supabase_key: str
    supabase_jwt_secret: str = ""

    # Google Maps — Street View photos
    google_maps_api_key: str = ""

    # Apify — skip tracing
    apify_token: str = ""

    # Telenyx — SMS outreach
    telenyx_api_key: str = ""
    telenyx_from_number: str = ""
    telenyx_webhook_secret: str = ""

    # Lumin — PDF contracts
    lumin_api_key: str = ""
    lumin_base_url: str = "https://api.luminpdf.com/v1"

    # Firecrawl — web extraction
    firecrawl_api_key: str = ""

    # Browserbase — headless browser
    browserbase_api_key: str = ""
    browserbase_project_id: str = ""

    # Redis — ARQ job queue
    redis_url: str = "redis://localhost:6379"


settings = Settings()
