"""
GitHub integration: webhook HMAC verification and a minimal API client for
reading Actions data and opening Pull Requests.

Security: the webhook secret and any token are read from env vars only,
never logged, and never persisted. Least-privilege scopes assumed: read
Actions, write Pull Requests.
"""
import hashlib
import hmac
import logging

from app.config import get_settings
from app.services.http_client import ExternalServiceError, request_with_retry

logger = logging.getLogger("pipelineguard.github")
settings = get_settings()


def verify_signature(payload_body: bytes, signature_header: str | None) -> bool:
    """Verify the `X-Hub-Signature-256` header using HMAC-SHA256."""
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    secret = settings.GITHUB_WEBHOOK_SECRET.encode()
    expected = "sha256=" + hmac.new(secret, payload_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)


async def create_pull_request(repo: str, title: str, body: str, head: str, base: str) -> dict | None:
    """
    Opens a real PR via the GitHub API. Returns None (never a fabricated PR
    object) if the call fails or no token is configured -- callers must not
    claim a PR was created unless this returns a real payload.
    """
    if not settings.GITHUB_TOKEN:
        logger.info("github_pr_skipped_no_token", extra={"repo": repo})
        return None

    headers = {
        "Authorization": f"Bearer {settings.GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
    }
    url = f"{settings.GITHUB_API_URL}/repos/{repo}/pulls"
    try:
        resp = await request_with_retry(
            "POST",
            url,
            json={"title": title, "body": body, "head": head, "base": base},
            headers=headers,
        )
        return resp.json()
    except ExternalServiceError as e:
        logger.error("github_pr_failed", extra={"repo": repo, "error": str(e)})
        return None
