import asyncio
import base64
import sys

import pytest
from sqlalchemy import select

from authoritative_test_support import authoritative_root


AUTHORITATIVE_ROOT = authoritative_root()
if str(AUTHORITATIVE_ROOT) not in sys.path:
    sys.path.insert(0, str(AUTHORITATIVE_ROOT))

from agent.orchestrator import DEFAULT_WORKFLOW  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.models.core import Investigation  # noqa: E402
from app.routers import analyze as analyze_router  # noqa: E402
from app.schemas.detection import CANONICAL_EVIDENCE_FIELDS  # noqa: E402
from app.services import detection_service  # noqa: E402
from app.services.detection_contract import (  # noqa: E402
    InvalidDetectionResponse,
    validate_detection_response,
)
from app.services.orchestration import run_pipeline_flow  # noqa: E402
from app.services.http_client import ExternalServiceError  # noqa: E402


def test_minimal_detection_response_is_valid_but_agentic_evidence_is_incomplete():
    result = validate_detection_response(
        {"status": "suspicious", "risk_score": 0.91}
    )

    assert result["detection_status"] == "complete_for_detection"
    assert result["agentic_evidence_status"] == "incomplete"
    assert result["source"] == "external_detection_core"
    assert result["contract_version"] == "v1"
    assert result["risk_score_scale"] == "0-1"
    assert result["available_evidence"] == ["risk_score"]
    assert "confidence" in result["missing_evidence"]
    assert result["risk_score"] == 0.91


def test_complete_detection_response_is_marked_complete():
    result = validate_detection_response(
        {
            "status": "suspicious",
            "risk_score": 0.91,
            "confidence": 0.97,
            "reasons": [],
            "affected_jobs": [],
            "graph_path": [],
            "model_breakdown": {"combined_score": 0.91},
            "diff": "diff --git a/workflow.yml b/workflow.yml",
            "remediation_risk": "low",
            "remediation_unambiguous": True,
        }
    )

    assert result["detection_status"] == "complete"
    assert result["agentic_evidence_status"] == "complete"
    assert result["missing_evidence"] == []
    assert result["available_evidence"] == list(CANONICAL_EVIDENCE_FIELDS)


@pytest.mark.parametrize(
    "payload",
    [
        {"status": "suspicious", "risk_score": -0.1},
        {"status": "suspicious", "risk_score": 1.1},
        {"status": "suspicious", "risk_score": float("inf")},
    ],
)
def test_invalid_risk_score_is_rejected(payload):
    with pytest.raises(InvalidDetectionResponse):
        validate_detection_response(payload)


def test_unknown_status_is_rejected():
    with pytest.raises(InvalidDetectionResponse):
        validate_detection_response({"status": "unknown", "risk_score": 0.5})


def test_live_detection_without_core_returns_unavailable_without_a_score(monkeypatch):
    monkeypatch.setattr(detection_service.settings, "DETECTION_CORE_URL", "")

    payload, used_fallback = asyncio.run(
        detection_service.analyze(
            "acme/repo",
            "run-unavailable",
            allow_demo_fallback=False,
        )
    )

    assert used_fallback is False
    assert payload["detection_status"] == "unavailable"
    assert payload["source"] == "external_detection_core"
    assert "risk_score" not in payload
    assert payload["agentic_evidence_status"] == "incomplete"


def test_live_detection_failure_is_unavailable_not_demo_fallback(monkeypatch):
    monkeypatch.setattr(
        detection_service.settings,
        "DETECTION_CORE_URL",
        "http://detection-core.test",
    )

    async def unavailable(*args, **kwargs):
        raise ExternalServiceError("connection refused")

    monkeypatch.setattr(detection_service, "request_with_retry", unavailable)

    payload, used_fallback = asyncio.run(
        detection_service.analyze(
            "acme/repo",
            "run-unavailable",
            allow_demo_fallback=False,
        )
    )

    assert used_fallback is False
    assert payload["detection_status"] == "unavailable"
    assert "risk_score" not in payload


def test_demo_fallback_is_explicitly_labeled():
    payload = detection_service.mock_detect("demo/repo", "demo-run")

    assert payload["source"] == "demo"
    assert payload["demo_mode"] is True
    assert payload["detection_status"] == "demo"
    assert payload["risk_score_scale"] == "0-100"


def test_minimal_detection_reaches_authoritative_escalation():
    db = SessionLocal()
    try:
        assessment = validate_detection_response(
            {"status": "suspicious", "risk_score": 0.91}
        )
        run = asyncio.run(
            run_pipeline_flow(
                db,
                repo_full_name="integration/minimal-detection",
                workflow_run_id="minimal-run",
                workflow_content=DEFAULT_WORKFLOW,
                detection_result=assessment,
                detection_used_fallback=False,
                source="live-analysis",
            )
        )

        assert run.decisions == ["refused"]
        assert run.status == "failed"
        assert run.risk_score == 91

        investigation = db.execute(
            select(Investigation).where(Investigation.run_id == run.id)
        ).scalar_one()
        assert investigation.thresholds["agenticAction"] == "ESCALATE_TO_HUMAN"
        assert investigation.thresholds["humanReviewRequired"] is True
    finally:
        db.close()


def test_analyze_endpoint_exposes_minimal_detection_as_successful_detection_with_incomplete_evidence(
    client,
    monkeypatch,
):
    class FakeResponse:
        def __init__(self, payload):
            self._payload = payload

        def json(self):
            return self._payload

    async def fake_github_request(method, url, **kwargs):
        if url.endswith("/contents/.github/workflows"):
            return FakeResponse(
                [
                    {
                        "path": ".github/workflows/ci.yml",
                        "url": "https://api.github.test/workflow",
                    }
                ]
            )
        return FakeResponse(
            {
                "encoding": "base64",
                "content": base64.b64encode(DEFAULT_WORKFLOW.encode()).decode(),
            }
        )

    async def fake_detection(repo, workflow_run_id, diff="", **kwargs):
        return (
            validate_detection_response(
                {"status": "suspicious", "risk_score": 0.91}
            ),
            False,
        )

    monkeypatch.setattr(analyze_router, "request_with_retry", fake_github_request)
    monkeypatch.setattr(analyze_router.detection_service, "analyze", fake_detection)

    response = client.post(
        "/api/v1/analyze",
        json={"repo": "integration/minimal-endpoint"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["detection_status"] == "complete_for_detection"
    assert body["agentic_evidence_status"] == "incomplete"
    assert body["detection_metadata"]["source"] == "external_detection_core"
    assert body["agentic_result"]["action"] == "ESCALATE_TO_HUMAN"
    assert body["agentic_result"]["fix"] is None