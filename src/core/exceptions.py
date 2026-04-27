from __future__ import annotations

from fastapi import HTTPException, status


class NotFoundError(HTTPException):
    def __init__(self, resource: str, id: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource} '{id}' not found",
        )


class UnauthorizedError(HTTPException):
    def __init__(self, detail: str = "Invalid or missing token"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class BadRequestError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class ExternalServiceError(Exception):
    def __init__(self, service: str, detail: str):
        super().__init__(f"{service} error: {detail}")
        self.service = service
