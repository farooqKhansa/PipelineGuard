# PipelineGuard Project State

Snapshot prepared for handoff on 2026-09-04.

## Status at a glance

| Area | Status | Notes |
| --- | --- | --- |
| Dashboard backend | Implemented | FastAPI, SQLAlchemy persistence, seed data, dashboard APIs, webhook flow, trace flow, and demo scenarios are present. |
| Workstream 2 agentic layer | Implemented and authoritative | The existing `agent/` and `audit/` packages are preserved without modification and loaded through `AGENTIC_LAYER_PATH`. |
| Detection Core boundary | Implemented | Strict version-one validation, explicit evidence metadata, score-scale handling, and unavailable/invalid states are present. |
| `/api/v1/analyze` integration | Implemented with conservative limits | GitHub workflow read, Detection Core boundary, authoritative policy, persistence, and frontend-shaped response are connected. |
| Demo/live separation | Implemented | Demo fallback is explicitly marked; live analysis does not silently use synthetic evidence. |
| Frontend | Grafted | Archive B's reusable Next.js frontend is under `frontend/`; live analysis uses Archive A's FastAPI gateway through a conservative adapter. |
| Hugging Face model | Integrated behind opt-in local provider | `FaizaML/pipelineguard-codebert-risk` is loaded lazily through a CPU-safe Transformers boundary. Input and status thresholds remain explicit, configurable PipelineGuard policy. |
| Standalone Detection Core | Prepared, not deployed | `detection_core_service/` exposes the same `/detect` contract for Docker-enabled or unrestricted environments such as GitHub Codespaces. |
| GitHub writes / pull requests / merge | Not implemented by design | The current flow performs no GitHub writes, PR creation, workflow execution, or merge. |

## Architecture

```text
GitHub webhook or /api/v1/analyze
        |
        v
Workflow content / repository context
        |
        v
Detection Core HTTP boundary
        |
        v
Strict Detection Core response validation
        |
        v
Canonical assessment adapter
        |
        v
Authoritative Workstream 2 agent/orchestrator
        |
        +--> decision, explanation, audit, verification, optional proposed fix
        |
        v
SQLAlchemy persistence and frontend-compatible response serializers
```

The dashboard backend lives under `app/`. The external Detection Core adapter is
implemented in `app/services/detection_service.py` and
`app/services/detection_contract.py`. The canonical structural adapter is
`app/services/assessment_adapter.py`. The authoritative Workstream 2 boundary
is `app/services/agentic_boundary.py`.

The frontend lives under `frontend/`. Its live `/analyze` path uses the
centralized browser API client and `frontend/src/lib/contract/backend-adapt.ts`;
the older contract adapter and fixtures are retained only for explicitly
selected replay.

## Implemented milestones

### Milestone 12 — local Hugging Face Detection Core

- Added an opt-in `local_huggingface` Detection Core provider.
- Preserved the existing external HTTP provider as the default.
- Added lazy, once-per-process model/tokenizer loading with CPU-safe
  `torch.no_grad()` inference.
- Computes `softmax(logits)[1]` as the `0–1` risk score.
- Added configurable workflow-text input, tokenization, and three-state
  threshold policy.
- Model load and inference failures return explicit unavailable/no-score
  responses without demo fallback.
- Documented verified model facts separately from unresolved training behavior
  and PipelineGuard integration policy.
- Added mocked focused tests without downloading the checkpoint.

### Milestone 13 — standalone Detection Core service

- Added an isolated `detection_core_service/` package for moving real model
  inference into a Docker-enabled or unrestricted Python environment.
- Preserved the existing `POST /detect` request and response contract.
- Added standalone configuration, Dockerfile, Codespaces README, and mocked
  tests.
- Added explicit HTTP failure responses with no fabricated score for invalid
  input, model loading failures, invalid output, and inference failures.
- Did not deploy the service or attempt to run PyTorch in the Replit runtime.

### Existing dashboard foundation

- FastAPI application and route registration
- SQLAlchemy models, SQLite development default, PostgreSQL deployment configuration
- Alembic schema migration
- Seed data and frontend-oriented serializers
- Dashboard, findings, investigations, fixes, audit, feed, trend, graph, replay, health, trace, demo, and webhook routes
- Bounded outbound HTTP timeout/retry behavior

### Milestone 8 — authoritative agentic boundary

- `POST /api/v1/agent/decision`
- Dynamic loading of the existing authoritative `agent/` and `audit/` packages
- No copying or replacement of Workstream 2 policy code
- Authoritative decision, explanation, audit, verification, human-review, and proposed-diff persistence
- Conservative unavailable behavior when workflow content or the authoritative package is unavailable
- No GitHub writes or PR creation

### Milestone 9 — Detection Core orchestration integration

- `/api/v1/analyze` calls `app.services.detection_service.analyze`
- Detection output flows through the canonical assessment adapter and authoritative Workstream 2
- Explicit score-scale handling; unknown scales are not silently rescaled
- Missing canonical evidence remains missing
- AUTO_FIX fixes remain `proposed`, never `applied`
- Complete, caution, escalation, missing-evidence, persistence, and analyze-flow tests

### Milestone 10 — Detection Core contract

- Strict v1 response contract for `status` and finite `risk_score` in the `0–1` range
- Optional canonical evidence fields remain optional and are never fabricated
- Explicit `source`, `contract_version`, `available_evidence`, `missing_evidence`, and `risk_score_scale` metadata
- Distinct `complete_for_detection`, `complete`, `invalid_response`, and `unavailable` states
- Minimal real Detection Core output reaches Workstream 2 as incomplete evidence and can produce `ESCALATE_TO_HUMAN`
- Demo fallback is explicitly labeled with `source: demo` and `demo_mode: true`
- Live `/api/v1/analyze` and non-demo orchestration disable synthetic fallback

### Milestone 11 — Frontend graft

- Archive B's reusable Next.js frontend was copied without its old backend,
  generated output, database, or local secrets
- Live analysis posts to Archive A's `/api/v1/analyze` through one centralized
  browser API boundary
- `backend-adapt.ts` preserves nullable evidence and converts risk scores only
  when `risk_score_scale` is declared
- Detection Core unavailable, invalid, incomplete, and successful states are
  visibly distinct
- `/live` uses the contract cassette only in explicit Replay mode; live mode
  points users to `/analyze`

## Backend endpoints

### Health and integration

- `GET /health`
- `POST /api/v1/agent/decision`
- `POST /api/v1/analyze`

### Dashboard reads

- `GET /api/v1/overview`
- `GET /api/v1/investigations`
- `GET /api/v1/investigations/{investigation_id}`
- `GET /api/v1/findings`
- `GET /api/v1/findings/{finding_id}`
- `GET /api/v1/fixes`
- `GET /api/v1/fixes/{fix_id}`
- `GET /api/v1/repositories`
- `GET /api/v1/repositories/{repo_id}`
- `GET /api/v1/pipelines`
- `GET /api/v1/pipelines/{pipeline_id}`
- `GET /api/v1/pipelines/{pipeline_id}/graph`
- `GET /api/v1/pipelines/{pipeline_id}/runs`
- `GET /api/v1/runs`
- `GET /api/v1/runs/{run_id}`
- `GET /api/v1/runs/{run_id}/trace`
- `GET /api/v1/graphs/{graph_id}`
- `GET /api/v1/trends`
- `GET /api/v1/alerts`
- `GET /api/v1/reviews`
- `GET /api/v1/audit`
- `GET /api/v1/policies`
- `GET /api/v1/policies/{policy_id}`
- `GET /api/v1/team`
- `GET /api/v1/integrations`
- `GET /api/v1/patterns`
- `GET /api/v1/incidents`
- `GET /api/v1/replay/cassettes`
- `GET /api/v1/feed`
- `GET /api/v1/feed/{run_id}`

### Demo and webhook

- `POST /api/v1/demo/scenario/{scenario_id}`
- `POST /api/v1/webhooks/github`

## Detection Core contract

The gateway calls `POST {DETECTION_CORE_URL}/detect` with:

```json
{
  "repo": "owner/repository",
  "workflow_run_id": "run-id",
  "diff": "workflow content"
}
```

Minimum valid response:

```json
{
  "status": "clean | suspicious | malicious",
  "risk_score": 0.0
}
```

Optional canonical evidence:

```json
{
  "confidence": 0.97,
  "reasons": [],
  "affected_jobs": [],
  "graph_path": [],
  "model_breakdown": {},
  "diff": "...",
  "remediation_risk": "low",
  "remediation_unambiguous": true
}
```

The complete contract is documented in
`docs/detection-core-contract.md`.

Minimal valid output means detection succeeded but evidence is incomplete:

```text
detection_status = complete_for_detection
agentic_evidence_status = incomplete
```

The authoritative policy then decides conservatively. It must not be treated
as a Detection Core transport failure.

## Authoritative package location

The handoff archive contains the authoritative package at:

```text
PipelineGuard/agent/
PipelineGuard/audit/
```

Set:

```text
AGENTIC_LAYER_PATH=./PipelineGuard
```

The current workspace also includes `tests/authoritative_test_support.py`.
When `AGENTIC_LAYER_PATH` is unset, it extracts the read-only
`PipelineGuard-current-backup.zip` into
`/tmp/pipelineguard_authoritative/PipelineGuard` for tests.

Do not edit or replace:

- `PipelineGuard/agent/decision.py`
- `PipelineGuard/agent/orchestrator.py`
- `PipelineGuard/agent/fix_generator.py`
- `PipelineGuard/agent/verifier.py`
- `PipelineGuard/agent/explanations.py`
- `PipelineGuard/agent/gemini_advisor.py`
- `PipelineGuard/audit/schemas.py`
- `PipelineGuard/audit/logger.py`

## Required configuration

Use `.env.example` as the template. No real `.env` file or credentials belong
in the archive.

Core:

- `ENV`
- `DEMO_MODE`
- `GATEWAY_VERSION`
- `LOG_LEVEL`

Database and CORS:

- `DATABASE_URL`
- `FRONTEND_ORIGINS`

Detection and agentic boundary:

- `DETECTION_CORE_URL`
- `AGENTIC_LAYER_URL` (legacy external boundary; normal orchestration uses the authoritative package path)
- `AGENTIC_LAYER_PATH`
- `DETECTION_RISK_SCORE_SCALE`
- `EXTERNAL_REQUEST_TIMEOUT_SECONDS`
- `EXTERNAL_REQUEST_MAX_RETRIES`

GitHub:

- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`
- `GITHUB_WEBHOOK_SECRET`
- `GITHUB_TOKEN`
- `GITHUB_API_URL`

Use the workspace secret mechanism or deployment secret configuration for
private keys, tokens, and webhook secrets.

## Run the backend

```bash
pip install -r requirements.txt
cp .env.example .env
export AGENTIC_LAYER_PATH=./PipelineGuard
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

The Docker path is also available:

```bash
docker compose up --build
```

## Test suites and verified results

Dependencies were already available in the source workspace.

```bash
python -m pytest -q tests/test_detection_core_contract.py
# 11 passed, 1 warning

python -m pytest -q tests
# 63 passed, 6 warnings

PYTHONPATH=./PipelineGuard python -m pytest -q PipelineGuard/tests
# 103 passed
```

Warnings are existing deprecation warnings from the test/runtime dependencies.

## Limitations and blockers

### Implemented

- Backend orchestration and persistence
- Authoritative Workstream 2 policy boundary
- Strict Detection Core contract
- Conservative incomplete-evidence behavior
- Explicit demo/live separation
- Test coverage for the implemented integration

### Partially implemented

- The local detector is integrated, but the original training input format,
  preprocessing, sequence length, calibration, and status thresholds remain
  unverified.
- The external Detection Core remains available and is still the default
  provider.
- `/api/v1/analyze` reads GitHub workflow content when accessible, but there is
  no GitHub write path.
- Backend responses are frontend-compatible, but the frontend itself is not in
  this snapshot.

### Not implemented

- Recovery of the model's original training and calibration behavior
- Real model-derived confidence, model breakdown, or remediation evidence
- Frontend application
- GitHub commits, pull requests, workflow execution, merge, or auto-merge
- Production deployment and external service provisioning

Incomplete real Workstream 1 evidence must continue to reach
`ESCALATE_TO_HUMAN`. No fallback score or evidence may be presented as real
live detection. The local model's provisional status thresholds are integration
policy, not validated model behavior.