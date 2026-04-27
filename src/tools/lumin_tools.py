from __future__ import annotations
"""
Lumin PDF e-signature tools.
Covers: creating a document, adding signers, sending for signature, checking status.
All functions return plain dicts suitable as tool results for Claude.
from __future__ import annotations
"""

import httpx

from src.core.config import settings

_BASE = settings.lumin_base_url  # https://api.luminpdf.com/v1
_HEADERS = {
    "Authorization": f"Bearer {settings.lumin_api_key}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}


def upload_contract(pdf_bytes: bytes, filename: str) -> dict:
    """
    Upload a PDF contract to Lumin and return the document ID.
    pdf_bytes: raw PDF content (generate from a template or fill via another library).
    """
    upload_headers = {
        "Authorization": f"Bearer {settings.lumin_api_key}",
        "Accept": "application/json",
    }
    files = {"file": (filename, pdf_bytes, "application/pdf")}
    resp = httpx.post(f"{_BASE}/documents", headers=upload_headers, files=files, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    return {
        "document_id": data.get("id", ""),
        "name": data.get("name", filename),
        "status": data.get("status", ""),
    }


def create_signature_request(
    document_id: str,
    signers: list[dict],  # [{"name": "...", "email": "...", "role": "signer"}]
    message: str = "Please sign the attached purchase agreement.",
    subject: str = "Purchase Agreement — Action Required",
) -> dict:
    """
    Create a Lumin signature request for the uploaded document.
    Returns envelope ID and signing URLs per signer.
    """
    payload = {
        "document_id": document_id,
        "subject": subject,
        "message": message,
        "signers": [
            {
                "name": s["name"],
                "email": s["email"],
                "role": s.get("role", "signer"),
                "order": i + 1,
            }
            for i, s in enumerate(signers)
        ],
    }
    resp = httpx.post(f"{_BASE}/signature-requests", json=payload, headers=_HEADERS, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    return {
        "envelope_id": data.get("id", ""),
        "status": data.get("status", ""),
        "signing_urls": [
            {"name": s.get("name"), "email": s.get("email"), "url": s.get("signing_url", "")}
            for s in data.get("signers", [])
        ],
        "expires_at": data.get("expires_at", ""),
    }


def get_signature_status(envelope_id: str) -> dict:
    """Poll Lumin for the current status of a signature request envelope."""
    resp = httpx.get(f"{_BASE}/signature-requests/{envelope_id}", headers=_HEADERS, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    return {
        "envelope_id": envelope_id,
        "status": data.get("status", ""),
        "signers": [
            {
                "name": s.get("name"),
                "email": s.get("email"),
                "status": s.get("status", ""),
                "signed_at": s.get("signed_at", ""),
            }
            for s in data.get("signers", [])
        ],
        "completed_at": data.get("completed_at", ""),
    }


def download_signed_document(envelope_id: str) -> bytes:
    """Download the fully signed PDF once status is 'completed'. Returns raw PDF bytes."""
    resp = httpx.get(
        f"{_BASE}/signature-requests/{envelope_id}/download",
        headers=_HEADERS,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.content


def void_signature_request(envelope_id: str, reason: str = "Voided by system") -> dict:
    """Cancel an in-progress signature request."""
    resp = httpx.post(
        f"{_BASE}/signature-requests/{envelope_id}/void",
        json={"reason": reason},
        headers=_HEADERS,
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    return {"envelope_id": envelope_id, "status": data.get("status", "voided")}
