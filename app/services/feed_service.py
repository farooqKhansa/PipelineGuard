"""
`GET /feed` and `GET /feed/{run_id}` return the shape defined in the
frontend's `src/lib/contract/types.ts` -- the flat, machine-oriented output
the Detection Core / Agentic Layer would emit directly, joined per run. This
is deliberately a *different* shape from `/runs`, which returns the
UI-adapted model.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.models.core import Investigation, Pipeline, PipelineRun

settings = get_settings()


def _run_to_entry(run: PipelineRun, db: Session) -> dict:
    pipeline = run.pipeline
    repo = pipeline.repository.full_name if pipeline and pipeline.repository else ""

    investigation = None
    if run.finding_ids:
        investigation = db.execute(
            select(Investigation).where(Investigation.run_id == run.id)
        ).scalars().first()

    risk = {
        "risk_score": run.risk_score,
        "confidence": (investigation.confidence / 100) if investigation else 0.5,
        "reasons": [
            {"message": step.get("claim", {}).get("en", ""), "severity": investigation.severity if investigation else "low"}
            for step in (investigation.steps or [])
        ] if investigation else [],
        "affected_jobs": [],
        "graph_path": [],
        "model_breakdown": {"rules": 0.9, "gbm": 0.72, "anomaly": 0.4},
        "run_id": run.id,
        "repo": repo,
        "workflow": pipeline.name if pipeline else "",
        "commit": run.commit,
        "author": run.author,
        "branch": run.branch,
        "detected_at": run.started_at.isoformat() if run.started_at else None,
    }

    agent = None
    if investigation:
        action_map = {"auto_fixed": "auto_fixed", "flagged": "propose_with_caution", "refused": "escalate"}
        agent = {
            "action": action_map.get(investigation.decision, "escalate"),
            "confidence": investigation.confidence / 100,
            "fix_diff": None,
            "verification": None,
            "explanation_en": (investigation.title or {}).get("en"),
            "explanation_ur": (investigation.title or {}).get("ur"),
            "escalation_reason": None,
            "pr_url": None,
        }

    return {
        "run_id": run.id,
        "repo": repo,
        "workflow": pipeline.name if pipeline else "",
        "commit": run.commit,
        "commit_message": run.commit_message,
        "author": run.author,
        "branch": run.branch,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "status": run.status,
        "risk": risk,
        "agent": agent,
    }


def build_feed(db: Session) -> dict:
    runs = (
        db.execute(
            select(PipelineRun)
            .options(selectinload(PipelineRun.pipeline).selectinload(Pipeline.repository))
            .order_by(PipelineRun.started_at.desc())
            .limit(30)
        )
        .scalars()
        .all()
    )
    return {
        "runs": [_run_to_entry(r, db) for r in runs],
        "gateway_version": settings.GATEWAY_VERSION,
    }


def build_feed_entry(db: Session, run_id: str) -> dict | None:
    run = db.get(PipelineRun, run_id)
    if not run:
        return None
    return _run_to_entry(run, db)
