import base64
import logging
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.services import detection_service
from app.services.http_client import ExternalServiceError, request_with_retry
from app.services.orchestration import run_pipeline_flow

logger = logging.getLogger("pipelineguard.analyze")
router = APIRouter(prefix="/api/v1", tags=["analyze"])
settings = get_settings()

REPO_RE = re.compile(r"^(?:https?://github\.com/)?([\w.-]+)/([\w.-]+?)(?:\.git)?/?$")


class AnalyzeRequest(BaseModel):
    repo: str
    token: str | None = None


def parse_repo_ref(repo: str) -> tuple[str, str] | None:
    m = REPO_RE.match(repo.strip())
    if not m:
        return None
    return m.group(1), m.group(2)


@router.post("/analyze")
async def analyze_repository(
    body: AnalyzeRequest,
    db: Session = Depends(get_db),
):
    ref = parse_repo_ref(body.repo)
    if not ref:
        raise HTTPException(status_code=400, detail={"error": "invalid_repo", "message": "Expected owner/repo or a github.com URL."})

    owner, repo = ref
    full_name = f"{owner}/{repo}"

    # The token, if supplied, is used only for this request's upstream calls.
    # It is never stored, never logged, never echoed back.
    headers = {"Accept": "application/vnd.github+json"}
    if body.token:
        headers["Authorization"] = f"Bearer {body.token.strip()}"

    workflows_path = f"{settings.GITHUB_API_URL}/repos/{owner}/{repo}/contents/.github/workflows"
    diff_text = ""
    workflow_path = ".github/workflows/ci.yml"
    try:
        resp = await request_with_retry("GET", workflows_path, headers=headers)
        files = resp.json()
        if isinstance(files, list) and files:
            first = files[0]
            workflow_path = first.get("path") or workflow_path
            file_resp = await request_with_retry("GET", first["url"], headers=headers)
            content = file_resp.json()
            if content.get("encoding") == "base64":
                diff_text = base64.b64decode(content["content"]).decode("utf-8", errors="replace")
    except ExternalServiceError as e:
        status = e.status_code or 502
        if status == 404:
            raise HTTPException(status_code=404, detail={"error": "github_error", "status": 404, "message": "No workflows found or repo not accessible."})
        raise HTTPException(status_code=502, detail={"error": "github_error", "status": status, "message": str(e)})

    try:
        result, used_fallback = await detection_service.analyze(
            full_name,
            workflow_run_id="live-analysis",
            diff=diff_text,
            allow_demo_fallback=False,
        )
    except ExternalServiceError as e:
        status = e.status_code or 502
        raise HTTPException(
            status_code=502,
            detail={
                "error": "detection_core_error",
                "status": status,
                "message": str(e),
            },
        )

    # This is an observable static signal from the downloaded workflow, but it
    # is retained only for the existing deterministic fallback. A configured
    # Workstream 1 response must pass through unchanged.
    if (
        used_fallback
        and "permissions:" in diff_text
        and "write-all" in diff_text
    ):
        result = dict(result)
        result["risk_score"] = max(result["risk_score"], 85)
        result["reasons"] = list(result.get("reasons") or [])
        result["reasons"].insert(
            0,
            {
                "message": "workflow requests write-all permissions",
                "severity": "critical",
            },
        )

    run = await run_pipeline_flow(
        db,
        repo_full_name=full_name,
        workflow_path=workflow_path,
        workflow_run_id="live-analysis",
        branch="main",
        diff=diff_text,
        workflow_content=diff_text,
        source="live-analysis",
        detection_result=result,
        detection_used_fallback=used_fallback,
        detection_score_scale=(
            result.get("risk_score_scale")
            or ("0-100" if used_fallback else settings.DETECTION_RISK_SCORE_SCALE)
        ),
    )
    agentic = getattr(run, "_agentic_result", None)

    return {
        "repo": full_name,
        "risk": result,
        "detection_status": result.get("detection_status"),
        "agentic_evidence_status": result.get("agentic_evidence_status"),
        "detection_metadata": {
            key: result.get(key)
            for key in (
                "source",
                "contract_version",
                "available_evidence",
                "missing_evidence",
                "risk_score_scale",
                "validation_errors",
            )
            if key in result
        },
        "source": "live-analysis",
        "run_id": run.id,
        "agentic_result": agentic["agentic_result"] if agentic else None,
        "agent": agentic["agent"] if agentic else None,
    }
