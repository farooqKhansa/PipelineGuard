import asyncio
import base64
import copy
import sys

from sqlalchemy import select

from authoritative_test_support import authoritative_root


AUTHORITATIVE_ROOT = authoritative_root()
if str(AUTHORITATIVE_ROOT) not in sys.path:
    sys.path.insert(0, str(AUTHORITATIVE_ROOT))

from agent.orchestrator import DEFAULT_WORKFLOW  # noqa: E402
from mocks.load_mock import load_and_validate_mock  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.models.core import AuditEntry, Fix, Investigation  # noqa: E402
from app.routers import analyze as analyze_router  # noqa: E402
from app.services.assessment_adapter import adapt_detection_assessment  # noqa: E402
from app.services.orchestration import run_pipeline_flow  # noqa: E402


def _run(assessment, repo_name):
    db = SessionLocal()
    try:
        return asyncio.run(
            run_pipeline_flow(
                db,
                repo_full_name=repo_name,
                workflow_run_id=f"{repo_name}-run",
                workflow_content=DEFAULT_WORKFLOW,
                detection_result=assessment,
                detection_used_fallback=False,
                detection_score_scale="0-1",
                source="integration-test",
            )
        )
    finally:
        db.close()


def test_dashboard_flow_persists_authoritative_auto_fix_result():
    assessment = load_and_validate_mock()
    run = _run(assessment, "integration/auto-fix")

    assert run.decisions == ["auto_fixed"]
    assert run.status == "passed"

    db = SessionLocal()
    try:
        investigation = db.execute(
            select(Investigation).where(Investigation.run_id == run.id)
        ).scalar_one()
        fix = db.execute(
            select(Fix).where(Fix.investigation_id == investigation.id)
        ).scalar_one()
        audit = db.execute(
            select(AuditEntry).where(AuditEntry.target == f"integration/auto-fix#{run.id}")
        ).scalar_one()

        assert fix.status == "proposed"
        assert fix.pull_request is None
        assert fix.hunks[0]["unifiedDiff"]
        assert fix.validation["status"] in {"passed", "passed_with_skips"}
        assert investigation.thresholds["agenticAction"] == "AUTO_FIX"
        assert investigation.thresholds["humanReviewRequired"] is False
        assert audit.detail["agenticResult"]["fix"]["unified_diff"]
        assert audit.detail["agenticResult"]["verification"]["checks"]
    finally:
        db.close()


def test_dashboard_flow_preserves_caution_without_placeholder_fix():
    assessment = load_and_validate_mock()
    assessment["remediation_risk"] = "high"
    run = _run(assessment, "integration/caution")

    assert run.decisions == ["flagged"]
    assert run.status == "passed"

    db = SessionLocal()
    try:
        investigation = db.execute(
            select(Investigation).where(Investigation.run_id == run.id)
        ).scalar_one()
        assert investigation.fix_id is None
        assert investigation.thresholds["agenticAction"] == "PROPOSE_WITH_CAUTION"
        assert investigation.thresholds["humanReviewRequired"] is True
        assert not db.execute(
            select(Fix).where(Fix.investigation_id == investigation.id)
        ).scalars().all()
    finally:
        db.close()


def test_dashboard_flow_preserves_escalation_reason():
    assessment = load_and_validate_mock()
    assessment["confidence"] = 0.50
    run = _run(assessment, "integration/escalate")

    assert run.decisions == ["refused"]
    assert run.status == "failed"

    db = SessionLocal()
    try:
        investigation = db.execute(
            select(Investigation).where(Investigation.run_id == run.id)
        ).scalar_one()
        assert investigation.fix_id is None
        assert investigation.thresholds["agenticAction"] == "ESCALATE_TO_HUMAN"
        assert investigation.thresholds["decisionReason"] == (
            "Confidence is below the safe AUTO_FIX threshold."
        )
        assert investigation.thresholds["humanReviewRequired"] is True
    finally:
        db.close()


def test_dashboard_flow_escalates_without_fabricating_missing_model_scores():
    assessment = load_and_validate_mock()
    assessment = copy.deepcopy(assessment)
    del assessment["model_breakdown"]["combined_score"]
    run = _run(assessment, "integration/missing-evidence")

    assert run.decisions == ["refused"]
    assert run.status == "failed"

    db = SessionLocal()
    try:
        investigation = db.execute(
            select(Investigation).where(Investigation.run_id == run.id)
        ).scalar_one()
        assert investigation.thresholds["agenticAction"] == "ESCALATE_TO_HUMAN"
        assert "combined_score" in investigation.thresholds["decisionReason"]
        assert investigation.fix_id is None
        assert not db.execute(
            select(Fix).where(Fix.investigation_id == investigation.id)
        ).scalars().all()
    finally:
        db.close()


def test_adapter_does_not_invent_canonical_fields_or_guess_score_scale():
    raw = {
        "risk_score": 42,
        "confidence": 0.91,
        "rules": 0.9,
        "reasons": [{"message": "observable workflow finding", "severity": "high"}],
    }

    adapted = adapt_detection_assessment(
        raw,
        repo="integration/adapter",
        workflow_run_id="adapter-run",
        risk_score_scale="unknown",
    )

    assert adapted["risk_score"] == 42
    assert adapted["reasons"] == ["observable workflow finding"]
    assert "model_breakdown" not in adapted
    assert "remediation_risk" not in adapted
    assert "remediation_unambiguous" not in adapted


def test_complete_workstream_one_assessment_flows_through_analyze_endpoint(
    client,
    monkeypatch,
):
    assessment = load_and_validate_mock()
    assessment["repo"] = "integration/live-analysis"
    assessment["workflow_run_id"] = "live-analysis"

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
        return assessment, False

    monkeypatch.setattr(analyze_router, "request_with_retry", fake_github_request)
    monkeypatch.setattr(analyze_router.detection_service, "analyze", fake_detection)
    monkeypatch.setattr(
        analyze_router.settings,
        "DETECTION_RISK_SCORE_SCALE",
        "0-1",
    )

    response = client.post(
        "/api/v1/analyze",
        json={"repo": "integration/live-analysis"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["agentic_result"]["action"] == "AUTO_FIX"
    assert body["agentic_result"]["decision"]["action"] == "AUTO_FIX"
    assert body["agentic_result"]["fix"]["unified_diff"]
    assert body["agentic_result"]["verification"]["checks"]
    assert body["agent"]["pr_url"] is None

    db = SessionLocal()
    try:
        investigation = db.execute(
            select(Investigation).where(
                Investigation.run_id == body["run_id"]
            )
        ).scalar_one()
        fix = db.execute(
            select(Fix).where(Fix.investigation_id == investigation.id)
        ).scalar_one()
        assert fix.status == "proposed"
        assert fix.pull_request is None
    finally:
        db.close()