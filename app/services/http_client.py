"""
Shared reliability wrapper for all outbound HTTP calls (Detection Core,
Agentic Layer, GitHub). No external call may hang indefinitely: every request
gets a timeout, a bounded number of retries with exponential backoff, and
explicit handling of 429 / 5xx.
"""
import asyncio
import logging
import time

import httpx

from app.config import get_settings

logger = logging.getLogger("pipelineguard.http")
settings = get_settings()


class ExternalServiceError(Exception):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


async def request_with_retry(
    method: str,
    url: str,
    *,
    json: dict | None = None,
    headers: dict | None = None,
    timeout: float | None = None,
    max_retries: int | None = None,
) -> httpx.Response:
    timeout = timeout if timeout is not None else settings.EXTERNAL_REQUEST_TIMEOUT_SECONDS
    max_retries = max_retries if max_retries is not None else settings.EXTERNAL_REQUEST_MAX_RETRIES

    last_exc: Exception | None = None
    async with httpx.AsyncClient(timeout=timeout) as client:
        for attempt in range(max_retries + 1):
            started = time.monotonic()
            try:
                resp = await client.request(method, url, json=json, headers=headers)
                duration_ms = int((time.monotonic() - started) * 1000)

                if resp.status_code == 429 or resp.status_code >= 500:
                    retry_after = resp.headers.get("Retry-After")
                    wait = float(retry_after) if retry_after else (2**attempt) * 0.5
                    logger.warning(
                        "external_request_retry",
                        extra={"url": url, "status": resp.status_code, "attempt": attempt, "duration_ms": duration_ms},
                    )
                    if attempt < max_retries:
                        await asyncio.sleep(wait)
                        continue
                    raise ExternalServiceError(f"{url} returned {resp.status_code} after retries", resp.status_code)

                resp.raise_for_status()
                return resp
            except httpx.TimeoutException as e:
                last_exc = e
                logger.warning("external_request_timeout", extra={"url": url, "attempt": attempt})
                if attempt < max_retries:
                    await asyncio.sleep((2**attempt) * 0.5)
                    continue
                raise ExternalServiceError(f"{url} timed out after {max_retries + 1} attempts") from e
            except httpx.HTTPStatusError as e:
                last_exc = e
                if e.response.status_code < 500 and e.response.status_code != 429:
                    raise ExternalServiceError(str(e), e.response.status_code) from e
                if attempt < max_retries:
                    await asyncio.sleep((2**attempt) * 0.5)
                    continue
                raise ExternalServiceError(str(e), e.response.status_code) from e
            except httpx.HTTPError as e:
                last_exc = e
                if attempt < max_retries:
                    await asyncio.sleep((2**attempt) * 0.5)
                    continue
                raise ExternalServiceError(str(e)) from e

    raise ExternalServiceError(str(last_exc) if last_exc else "unknown error")
