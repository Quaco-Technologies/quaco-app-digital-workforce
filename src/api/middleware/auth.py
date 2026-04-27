from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import Depends, Header

from src.core.database import get_db
from src.core.exceptions import UnauthorizedError


async def get_investor_id(authorization: Optional[str] = Header(None)) -> UUID:
    """
    FastAPI dependency — validates the Supabase JWT by calling get_user()
    on the Supabase auth server, then returns the investor UUID.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedError()

    token = authorization.removeprefix("Bearer ").strip()

    try:
        db = get_db()
        response = db.auth.get_user(token)
        user = response.user
    except Exception as e:
        raise UnauthorizedError(f"Token invalid: {e}")

    if not user:
        raise UnauthorizedError("Token invalid: no user found")

    try:
        return UUID(user.id)
    except (ValueError, AttributeError):
        raise UnauthorizedError("Invalid investor ID in token")
