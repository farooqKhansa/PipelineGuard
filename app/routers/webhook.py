import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.core import PipelineRun, WebhookEvent
from app.services.github_service import verify_signature
from app.services.orchestration import run_pipeline_flow

logger = logging.getLogger("pipelineguard.webhook")

router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])


@router.post("/github")
async def github_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_hub_signature_256: str | None = Header(default=None),
    x_github_event: str | None = Header(default=None),
    x_github_delivery: str | None = Header(default=None),
):
    raw_body = await request.body()

    if not verify_signature(raw_body, x_hub_signature_256):
        logger.warning("webhook_signature_invalid", extra={"event": "webhook_received", "status": "rejected"})
        raise HTTPException(status_code=401, detail="invalid_signature")

    payload = await request.json()
    delivery_id = x_github_delivery or payload.get("delivery_id")
    if not delivery_id:
        raise HTTPException(status_code=400, detail="missing_delivery_id")

    # --- Idempotency: a GitHub delivery ID is unique per event. ---
    existing = db.query(WebhookEvent).filter(WebhookEvent.delivery_id == delivery_id).one_or_none()
    if existing:
        run = db.get(PipelineRun, existing.run_id) if existing.run_id else None
        return {
            "status": "duplicate",
            "delivery_id": delivery_id,
            "run_id": existing.run_id,
            "message": "This delivery was already processed; no new run was created.",
        }

    event = WebhookEvent(delivery_id=delivery_id, event_type=x_github_event or "unknown", status="processing")
    db.add(event)
    db.flush()

    if x_github_event not in (None, "workflow_run", "push", "pull_request"):
        event.status = "ignored"
        db.commit()
        return {"status": "ignored", "event_type": x_github_event}

    repo_full_name = (payload.get("repository") or {}).get("full_name", "unknown/unknown")
    workflow_run = payload.get("workflow_run") or {}
    head_commit = payload.get("head_commit") or {}

    try:
        run = await run_pipeline_flow(
            db,
            repo_full_name=repo_full_name,
            workflow_path=workflow_run.get("path", ".github/workflows/ci.yml"),
            workflow_run_id=str(workflow_run.get("id") or payload.get("after") or delivery_id),
            commit=(payload.get("after") or workflow_run.get("head_sha") or "")[:7],
            commit_message=head_commit.get("message", ""),
            author=(head_commit.get("author") or {}).get("name", ""),
            branch=(payload.get("ref") or workflow_run.get("head_branch") or "main").replace("refs/heads/", ""),
            source="webhook",
        )
    except Exception as e:
        event.status = "failed"
        db.commit()
        raise HTTPException(status_code=502, detail=f"pipeline_flow_failed: {e}") from e

    event.run_id = run.id
    event.repo = repo_full_name
    event.status = "processed"
    db.commit()

    return {"status": "processed", "delivery_id": delivery_id, "run_id": run.id}
