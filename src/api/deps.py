from __future__ import annotations

from src.core.database import get_db
from src.repositories import Repositories


def get_repos() -> Repositories:
    """FastAPI dependency — provides all repositories backed by Supabase."""
    return Repositories(get_db())
