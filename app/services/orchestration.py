"""
The PipelineGuard flow:

    webhook -> PipelineRun -> Detection Core -> Risk -> Agentic Layer
    -> decision -> fix proposal -> DB -> audit -> trace

Used by both the real GitHub webhook handler and the deterministic demo
scenario endpoints, so the trace looks identical either way. This flow does
not perform GitHub writes or create pull requests.
"""
import logging
import time
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.core import (
    AgentActivity,
    AuditEntry,
    Fix,
    Investigation,
    Pipeline,
    PipelineRun,
    Repository,
    RunTraceEvent,
)
from app.services import detection_service
from app.services.agentic_boundary import (
    AgenticLayerUnavailable,
    run_agentic_decision,
    unavailable_agentic_result,
)
from app.services.assessment_adapter import (
    adapt_detection_assessment,
    dashboard_risk_score,
)

logger = logging.getLogger("pipelineguard.orchestration")
settings = get_settings()

ACTION_TO_DECISION = {
    "AUTO_FIX": "auto_fixed",
    "PROPOSE_WITH_CAUTION": "flagged",
    "ESCALATE_TO_HUMAN": "refused",
}


def _log_stage(event: str, **fields):
    logger.info(event, extra={"event": event, **fields})


def _trace(db: Session, run_id: str, stage: str, status: str, duration_ms: int, detail: dict):
    db.add(RunTraceEvent(run_id=run_id, stage=stage, status=status, duration_ms=duration_ms, detail=detail))


def _get_or_create_repo_pipeline(db: Session, repo_full_name: str, workflow_path: str) -> tuple[Repository, Pipeline]:
    repo = db.query(Repository).filter(Repository.full_name == repo_full_name).one_or_none()
    if not repo:
        org = None
        from app.models.core import Organization

        org = db.query(Organization).first()
        repo = Repository(
            organization_id=org.id if org else None,
            name=repo_full_name.split("/")[-1],
            full_name=repo_full_name,
            provider="github",
        )
        db.add(repo)
        db.flush()

    pipeline = db.query(Pipeline).filter(Pipeline.repository_id == repo.id, Pipeline.file_path == workflow_path).one_or_none()
    if not pipeline:
        pipeline = Pipeline(
            repository_id=repo.id,
            name=workflow_path.rsplit("/", 1)[-1] if workflow_path else "workflow",
            file_path=workflow_path or ".github/workflows/ci.yml",
        )
        db.add(pipeline)
        db.flush()

    return repo, pipeline


async def run_pipeline_flow(
    db: Session,
    *,
    repo_full_name: str,
    workflow_path: str = ".github/workflows/ci.yml",
    workflow_run_id: str | None = None,
    commit: str = "",
    commit_message: str = "",
    author: str = "",
    branch: str = "main",
    diff: str = "",
    workflow_content: str = "",
    source: str = "webhook",
    forced_risk_score: int | None = None,
    detection_result: dict | None = None,
    detection_used_fallback: bool | None = None,
    detection_score_scale: str | None = None,
) -> PipelineRun:
    t0 = time.monotonic()
    repo, pipeline = _get_or_create_repo_pipeline(db, repo_full_name, workflow_path)

    run = PipelineRun(
        pipeline_id=pipeline.id,
        number=(db.query(PipelineRun).filter(PipelineRun.pipeline_id == pipeline.id).count() + 1),
        status="analyzing",
        branch=branch,
        commit=commit or uuid.uuid4().hex[:7],
        commit_message=commit_message,
        author=author,
        started_at=datetime.now(timezone.utc),
        workflow_run_id=workflow_run_id,
        source=source,
    )
    db.add(run)
    db.flush()

    _trace(db, run.id, "webhook_received", "ok", 0, {"repo": repo_full_name, "workflow_run_id": workflow_run_id})
    _log_stage("webhook_received", run_id=run.id, repository=repo_full_name, stage="webhook_received", status="ok")

    # --- Detection ---
    stage_t0 = time.monotonic()
    _trace(db, run.id, "detection_started", "ok", 0, {})
    try:
        if detection_result is None:
            risk, det_fallback = await detection_service.analyze(
                repo_full_name,
                workflow_run_id or run.id,
                diff,
                allow_demo_fallback=source == "demo",
            )
        else:
            risk = dict(detection_result)
            det_fallback = bool(detection_used_fallback)
        if forced_risk_score is not None:
            risk["risk_score"] = forced_risk_score
        source_scale = risk.get("risk_score_scale") or detection_score_scale or (
            "0-100" if det_fallback else settings.DETECTION_RISK_SCORE_SCALE
        )
        assessment = adapt_detection_assessment(
            risk,
            repo=repo_full_name,
            workflow_run_id=workflow_run_id or run.id,
            risk_score_scale=source_scale,
        )
        duration_ms = int((time.monotonic() - stage_t0) * 1000)
        _trace(
            db,
            run.id,
            "detection_completed",
            risk.get("detection_status") or ("fallback" if det_fallback else "ok"),
            duration_ms,
            {
                "risk_score": risk.get("risk_score"),
                "used_fallback": det_fallback,
                "source": risk.get("source"),
                "detection_status": risk.get("detection_status"),
                "agentic_evidence_status": risk.get("agentic_evidence_status"),
                "available_evidence": risk.get("available_evidence"),
                "missing_evidence": risk.get("missing_evidence"),
            },
        )
        _log_stage(
            "detection_completed",
            run_id=run.id,
            repository=repo_full_name,
            stage="detection_completed",
            status=risk.get("detection_status") or ("fallback" if det_fallback else "ok"),
            duration_ms=duration_ms,
        )
    except Exception as e:  # pragma: no cover - only reached if DEMO_MODE is off and service is down
        duration_ms = int((time.monotonic() - stage_t0) * 1000)
        _trace(db, run.id, "detection_completed", "error", duration_ms, {"error": str(e)})
        run.status = "failed"
        _trace(db, run.id, "pipeline_failed", "error", 0, {"reason": "detection_core_unavailable"})
        db.flush()
        raise

    run.risk_score = dashboard_risk_score(assessment, source_scale=source_scale)

    # --- Agentic decision ---
    stage_t0 = time.monotonic()
    _trace(db, run.id, "agent_started", "ok", 0, {})
    try:
        if not workflow_content.strip():
            agent_out = unavailable_agentic_result(
                "Complete workflow content is unavailable; the authoritative "
                "agentic layer was not called.",
                assessment=assessment,
            )
            agent_fallback = True
        else:
            try:
                agent_out = run_agentic_decision(assessment, workflow_content)
            except AgenticLayerUnavailable as error:
                agent_out = unavailable_agentic_result(
                    str(error),
                    assessment=assessment,
                )
                agent_fallback = True
            else:
                agent_fallback = False

        agent_result = agent_out["agentic_result"]
        agent_view = agent_out["agent"]
        duration_ms = int((time.monotonic() - stage_t0) * 1000)
        _trace(
            db,
            run.id,
            "agent_completed",
            "fallback" if agent_fallback else "ok",
            duration_ms,
            {
                "action": agent_result.get("action"),
                "used_fallback": agent_fallback,
                "error": agent_result.get("error"),
            },
        )
        _log_stage("agent_completed", run_id=run.id, repository=repo_full_name, stage="agent_completed", status="ok", duration_ms=duration_ms)
    except Exception as e:  # pragma: no cover
        duration_ms = int((time.monotonic() - stage_t0) * 1000)
        _trace(db, run.id, "agent_completed", "error", duration_ms, {"error": str(e)})
        run.status = "failed"
        _trace(db, run.id, "pipeline_failed", "error", 0, {"reason": "agentic_layer_unavailable"})
        db.flush()
        raise

    agent_action = agent_result.get("action")
    decision = ACTION_TO_DECISION.get(agent_action, "refused")
    confidence = agent_view.get("confidence")
    confidence_pct = round(confidence * 100) if isinstance(confidence, (int, float)) else 0

    # --- Investigation record (drives the reasoning UI) ---
    explanation_en = agent_view.get("explanation_en")
    explanation_ur = agent_view.get("explanation_ur")
    reasoning = agent_view.get("reasoning") or []
    review_items = agent_view.get("review_items") or []
    audit_metadata = agent_result.get("audit")
    investigation = Investigation(
        finding_id="",
        title={
            "en": explanation_en or "Automated pipeline review",
            "ur": explanation_ur or "",
        },
        repo=repo_full_name,
        pipeline=pipeline.name,
        pipeline_id=pipeline.id,
        run_id=run.id,
        commit=run.commit,
        commit_message=commit_message,
        author=author,
        branch=branch,
        file_path=pipeline.file_path,
        severity="critical" if run.risk_score >= 80 else "high" if run.risk_score >= 60 else "medium" if run.risk_score >= 35 else "low",
        decision=decision,
        confidence=confidence_pct,
        started_at=run.started_at,
        duration_ms=int((time.monotonic() - t0) * 1000),
        steps=[
            {
                "id": f"{run.id}-reason-{index}",
                "kind": "agent_decision",
                "title": {"en": "Agentic decision evidence", "ur": ""},
                "claim": {"en": str(reason), "ur": ""},
                "because": [],
                "citations": [],
            }
            for index, reason in enumerate(reasoning)
        ],
        gaps=[{"en": str(item), "ur": ""} for item in review_items],
        thresholds={
            "agenticAction": agent_action,
            "deterministicAction": agent_result.get("deterministic_action"),
            "decisionReason": agent_view.get("decision_reason"),
            "remediationRisk": assessment.get("remediation_risk"),
            "remediationUnambiguous": assessment.get("remediation_unambiguous"),
            "humanReviewRequired": agent_result.get("human_review_required"),
            "warnings": agent_result.get("warnings"),
            "error": agent_result.get("error"),
            "audit": audit_metadata,
        },
    )
    db.add(investigation)
    db.flush()

    fix = None
    fix_data = agent_result.get("fix")
    if isinstance(fix_data, dict) and fix_data.get("unified_diff"):
        verification = agent_result.get("verification")
        verification_status = (
            verification.get("status")
            if isinstance(verification, dict)
            else "unknown"
        )
        fix = Fix(
            investigation_id=investigation.id,
            title={"en": f"Fix for {pipeline.file_path}", "ur": ""},
            file_path=pipeline.file_path,
            hunks=[
                {
                    "unifiedDiff": fix_data["unified_diff"],
                    "originalWorkflow": fix_data.get("original_workflow"),
                    "fixedWorkflow": fix_data.get("fixed_workflow"),
                }
            ],
            prevents={},
            rationale={"en": agent_view.get("decision_reason") or "", "ur": ""},
            validation={
                "verified": verification_status == "passed",
                "status": verification_status,
                "checks": (verification or {}).get("checks", []) if isinstance(verification, dict) else [],
            },
            # AUTO_FIX authorizes generation only. This dashboard flow does
            # not apply changes or create a pull request.
            status="proposed",
            pull_request=None,
        )
        db.add(fix)
        db.flush()
        investigation.fix_id = fix.id

        _trace(
            db,
            run.id,
            "fix_created",
            "ok",
            0,
            {"fix_id": fix.id, "pull_request_created": False},
        )

    run.status = (
        "passed"
        if decision != "refused" and not agent_result.get("error")
        else "failed"
    )
    run.duration_ms = int((time.monotonic() - t0) * 1000)
    run.decisions = [decision]

    db.add(
        AgentActivity(
            at=run.started_at,
            decision=decision,
            title=investigation.title,
            repo=repo_full_name,
            confidence=confidence_pct,
            investigation_id=investigation.id,
            duration_ms=run.duration_ms,
        )
    )
    db.add(
        AuditEntry(
            actor="pipelineguard-agent",
            actor_kind="agent",
            action=f"decision:{agent_action or 'UNAVAILABLE'}",
            target=f"{repo_full_name}#{run.id}",
            detail={
                "agenticResult": agent_result,
                "agent": agent_view,
            },
            outcome="refused" if decision == "refused" else "success",
        )
    )

    # Make the authoritative result available to callers that initiated this
    # flow (for example POST /api/v1/analyze) without adding a new database
    # column or changing the existing PipelineRun serializer contract.
    run._agentic_result = agent_out
    db.commit()
    db.refresh(run)
    run._agentic_result = agent_out
    return run
