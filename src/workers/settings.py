from __future__ import annotations

import ssl
import urllib.parse

from arq.connections import RedisSettings

from src.core.config import settings
from src.workers.tasks import (
    shutdown,
    startup,
    task_analyze_deal,
    task_generate_contract,
    task_handle_signature_complete,
    task_handle_sms_reply,
    task_ingest_leads,
    task_outreach,
    task_run_acquisition,
    task_skip_trace,
)


def _redis_settings_from_url(url: str) -> RedisSettings:
    """Parse a redis:// or rediss:// URL into ARQ RedisSettings.
    Upstash requires ssl=True and ssl_cert_reqs=None (skips hostname check)."""
    parsed = urllib.parse.urlparse(url)
    use_ssl = parsed.scheme == "rediss"
    password = parsed.password or None
    username = parsed.username or "default"
    host = parsed.hostname or "localhost"
    port = parsed.port or (6379 if not use_ssl else 6380)
    database = int(parsed.path.lstrip("/") or "0")

    ssl_ctx = None
    if use_ssl:
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE

    return RedisSettings(
        host=host,
        port=port,
        username=username,
        password=password,
        database=database,
        ssl=use_ssl,
        ssl_ca_certs=None,
        ssl_cert_reqs=None if use_ssl else "required",
    )


# ARQ worker configuration — run with: arq src.workers.settings.WorkerSettings
class WorkerSettings:
    redis_settings = _redis_settings_from_url(settings.redis_url)
    functions = [
        task_run_acquisition,
        task_ingest_leads,
        task_skip_trace,
        task_analyze_deal,
        task_outreach,
        task_generate_contract,
        task_handle_sms_reply,
        task_handle_signature_complete,
    ]
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = 5
    job_timeout = 1800  # 30 min — browser steps are slow
