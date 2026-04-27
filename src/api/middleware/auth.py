from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import Depends, Header

from src.core.config import settings
from src.core.database import get_db
from src.core.exceptions import UnauthorizedError

# Fixed UUID used when requests are authenticated via the service-role key (dev/CI mode).
# The leads table has investor_id as an optional FK — NULL is valid, but we use a stable
# UUID so list queries work consistently across dev sessions.
_DEV_INVESTOR_ID = UUID("00000000-0000-0000-0000-000000000001")


async def get_investor_id(authorization: Optional[str] = Header(None)) -> UUID:
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedError()

    token = authorization.removeprefix("Bearer ").strip()

    # Dev bypass: service-role key acts as a superuser token.
    # This lets curl/Postman/the pipeline work without a real Supabase user session.
    if token == settings.supabase_key:
        return _DEV_INVESTOR_ID

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
