from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.orchestration import run_pipeline_flow

router = APIRouter(prefix="/api/v1/demo", tags=["demo"])

DEMO_WORKFLOW = """name: CI

on:
  push:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./scripts/test.sh

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        run: ./scripts/deploy.sh
"""


# Fixed canonical assessments per scenario. These are inputs to the real
# agentic decision engine; the endpoint does not hardcode its final response.
SCENARIOS = {
    1: dict(
        repo_full_name="pipelineguard-demo/auto-fix-sample",
        workflow_path=".github/workflows/ci.yml",
        commit="a1b2c3d",
        commit_message="chore: bump timeout on flaky job",
        author="demo-bot",
        branch="main",
        workflow_content=DEMO_WORKFLOW,
        detection_result={
            "risk_score": 0.91,
            "confidence": 0.97,
            "reasons": [
                "The security test gate is missing from the current workflow.",
                "The baseline diff identifies one isolated job restoration.",
            ],
            "affected_jobs": ["security-tests"],
            "graph_path": ["checkout", "test", "security-tests", "deploy"],
            "model_breakdown": {
                "pipeline_score": 0.93,
                "code_score": 0.88,
                "combined_score": 0.91,
            },
            "diff": (
                "--- a/.github/workflows/ci.yml\n"
                "+++ b/.github/workflows/ci.yml\n"
                "@@ -12,13 +12,6 @@ jobs:\n"
                "-  security-tests:\n"
                "-    needs: test\n"
                "-    runs-on: ubuntu-latest\n"
                "-    steps:\n"
                "-      - uses: actions/checkout@v4\n"
                "-      - name: Run security tests\n"
                "-        run: ./scripts/security-tests.sh\n"
            ),
            "remediation_risk": "low",
            "remediation_unambiguous": True,
            "source": "demo",
            "risk_score_scale": "0-1",
        },
        detection_used_fallback=False,
        detection_score_scale="0-1",
    ),
    2: dict(
        repo_full_name="pipelineguard-demo/propose-sample",
        workflow_path=".github/workflows/deploy.yml",
        commit="d4e5f6a",
        commit_message="ci: add new deploy secret to job",
        author="demo-bot",
        branch="main",
        workflow_content=DEMO_WORKFLOW,
        detection_result={
            "risk_score": 0.72,
            "confidence": 0.94,
            "reasons": [
                "A new secret is consumed without an environment gate.",
                "The affected deploy path can impact production resources.",
            ],
            "affected_jobs": ["deploy"],
            "graph_path": ["checkout", "test", "deploy"],
            "model_breakdown": {
                "pipeline_score": 0.76,
                "code_score": 0.68,
                "combined_score": 0.72,
            },
            "diff": (
                "--- a/.github/workflows/deploy.yml\n"
                "+++ b/.github/workflows/deploy.yml\n"
                "@@ -20,0 +20,2 @@ jobs:\n"
                "+      - run: ./scripts/deploy.sh\n"
            ),
            "remediation_risk": "high",
            "remediation_unambiguous": True,
            "source": "demo",
            "risk_score_scale": "0-1",
        },
        detection_used_fallback=False,
        detection_score_scale="0-1",
    ),
    3: dict(
        repo_full_name="pipelineguard-demo/escalate-sample",
        workflow_path=".github/workflows/release.yml",
        commit="f7a8b9c",
        commit_message="ci: widen permissions to write-all for release job",
        author="demo-bot",
        branch="main",
        workflow_content=DEMO_WORKFLOW,
        detection_result={
            "risk_score": 0.92,
            "confidence": 0.50,
            "reasons": [
                "Release permissions were widened to write-all.",
                "The change affects the protected release workflow.",
            ],
            "affected_jobs": ["release"],
            "graph_path": ["build", "release"],
            "model_breakdown": {
                "pipeline_score": 0.94,
                "code_score": 0.90,
                "combined_score": 0.92,
            },
            "diff": (
                "--- a/.github/workflows/release.yml\n"
                "+++ b/.github/workflows/release.yml\n"
                "@@ -8,1 +8,1 @@ permissions:\n"
                "-  contents: read\n"
                "+  contents: write\n"
            ),
            "remediation_risk": "high",
            "remediation_unambiguous": True,
            "source": "demo",
            "risk_score_scale": "0-1",
        },
        detection_used_fallback=False,
        detection_score_scale="0-1",
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
