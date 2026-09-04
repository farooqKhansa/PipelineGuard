from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.orchestration import run_pipeline_flow

router = APIRouter(prefix="/api/v1/demo", tags=["demo"])

# Fixed inputs per scenario so risk_score (and therefore the agent action) is
# deterministic every run -- required for a reliable live demo.
SCENARIOS = {
    1: dict(  # Legacy demo input: missing canonical fields, so it escalates
        repo_full_name="pipelineguard-demo/auto-fix-sample",
        workflow_path=".github/workflows/ci.yml",
        commit="a1b2c3d",
        commit_message="chore: bump timeout on flaky job",
        author="demo-bot",
        branch="main",
        forced_risk_score=25,
    ),
    2: dict(  # Legacy demo input: missing canonical fields, so it escalates
        repo_full_name="pipelineguard-demo/propose-sample",
        workflow_path=".github/workflows/deploy.yml",
        commit="d4e5f6a",
        commit_message="ci: add new deploy secret to job",
        author="demo-bot",
        branch="main",
        forced_risk_score=60,
    ),
    3: dict(  # Legacy demo input: missing canonical fields, so it escalates
        repo_full_name="pipelineguard-demo/escalate-sample",
        workflow_path=".github/workflows/release.yml",
        commit="f7a8b9c",
        commit_message="ci: widen permissions to write-all for release job",
        author="demo-bot",
        branch="main",
        forced_risk_score=92,
    ),
}


@router.post("/scenario/{scenario_id}")
async def run_scenario(scenario_id: int, db: Session = Depends(get_db)):
    if scenario_id not in SCENARIOS:
        raise HTTPException(status_code=404, detail="unknown_scenario")

    params = SCENARIOS[scenario_id]
    run = await run_pipeline_flow(db, source="demo", **params)

    return {
        "scenario": scenario_id,
        "runId": run.id,
        "status": run.status,
        "riskScore": run.risk_score,
        "decisions": run.decisions,
        "traceUrl": f"/api/v1/runs/{run.id}/trace",
    }
