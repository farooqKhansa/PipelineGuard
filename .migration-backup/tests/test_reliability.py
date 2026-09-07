import asyncio

import httpx
import pytest

from app.config import get_settings
from app.services import agentic_service, detection_service
from app.services.http_client import ExternalServiceError, request_with_retry


def test_detection_core_falls_back_when_unset(anyio_backend=None):
    """DETECTION_CORE_URL unset -> always uses the deterministic mock, never fails."""
    settings = get_settings()
    assert settings.DETECTION_CORE_URL == ""
    payload, used_fallback = asyncio.run(detection_service.analyze("acme/repo", "run-1"))
    assert used_fallback is True
    assert 0 <= payload["risk_score"] <= 100
    assert payload["repo"] == "acme/repo"


def test_detection_core_unreachable_falls_back_under_demo_mode(monkeypatch):
    monkeypatch.setattr(detection_service.settings, "DETECTION_CORE_URL", "http://127.0.0.1:1")
    monkeypatch.setattr(detection_service.settings, "DEMO_MODE", True)
    payload, used_fallback = asyncio.run(detection_service.analyze("acme/repo", "run-2"))
    assert used_fallback is True
    assert "risk_score" in payload


def test_detection_core_unreachable_raises_when_demo_mode_off(monkeypatch):
    monkeypatch.setattr(detection_service.settings, "DETECTION_CORE_URL", "http://127.0.0.1:1")
    monkeypatch.setattr(detection_service.settings, "DEMO_MODE", False)
    with pytest.raises(ExternalServiceError):
        asyncio.run(detection_service.analyze("acme/repo", "run-3"))
    # restore for other tests
    monkeypatch.setattr(detection_service.settings, "DEMO_MODE", True)


def test_agentic_layer_unreachable_falls_back_under_demo_mode(monkeypatch):
    monkeypatch.setattr(agentic_service.settings, "AGENTIC_LAYER_URL", "http://127.0.0.1:1")
    monkeypatch.setattr(agentic_service.settings, "DEMO_MODE", True)
    payload, used_fallback = asyncio.run(agentic_service.decide({"risk_score": 30, "confidence": 0.8}))
    assert used_fallback is True
    assert payload["action"] in ("auto_fix", "propose_with_caution", "escalate")


def test_agentic_mock_decision_matches_risk_band():
    low = agentic_service.mock_decide({"risk_score": 10, "confidence": 0.9})
    mid = agentic_service.mock_decide({"risk_score": 55, "confidence": 0.7})
    high = agentic_service.mock_decide({"risk_score": 95, "confidence": 0.3})
    assert low["action"] == "auto_fix"
    assert mid["action"] == "propose_with_caution"
    assert high["action"] == "escalate"


def test_request_with_retry_handles_429_then_success(monkeypatch):
    calls = {"n": 0}

    async def fake_request(self, method, url, json=None, headers=None):
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(429, headers={"Retry-After": "0"}, request=httpx.Request(method, url))
        return httpx.Response(200, json={"ok": True}, request=httpx.Request(method, url))

    monkeypatch.setattr(httpx.AsyncClient, "request", fake_request)
    resp = asyncio.run(request_with_retry("GET", "http://example.test/thing", max_retries=2, timeout=1))
    assert resp.status_code == 200
    assert calls["n"] == 2


def test_request_with_retry_gives_up_after_max_retries_on_5xx(monkeypatch):
    async def always_500(self, method, url, json=None, headers=None):
        return httpx.Response(500, request=httpx.Request(method, url))

    monkeypatch.setattr(httpx.AsyncClient, "request", always_500)
    with pytest.raises(ExternalServiceError):
        asyncio.run(request_with_retry("GET", "http://example.test/thing", max_retries=1, timeout=1))


def test_request_with_retry_does_not_retry_4xx_other_than_429(monkeypatch):
    calls = {"n": 0}

    async def always_404(self, method, url, json=None, headers=None):
        calls["n"] += 1
        return httpx.Response(404, request=httpx.Request(method, url))

    monkeypatch.setattr(httpx.AsyncClient, "request", always_404)
    with pytest.raises(ExternalServiceError):
        asyncio.run(request_with_retry("GET", "http://example.test/thing", max_retries=3, timeout=1))
    assert calls["n"] == 1  # no retry on plain 404
