# Continue PipelineGuard Development

This snapshot contains the backend integration baseline plus the frontend graft.
It is not a completed production product. Start from these files rather than
reconstructing the architecture from the older uploaded project archives.

## First setup

1. Install `requirements.txt`.
2. Copy `.env.example` to `.env` and add environment-specific values through
   the workspace/deployment secret mechanism.
3. Set `AGENTIC_LAYER_PATH=./PipelineGuard`.
4. Run the database migration and seed commands from `PROJECT_STATE.md`.
5. Run the dashboard and authoritative test suites before making changes.

## Do not rewrite

The following are policy authority and must remain unchanged unless a future
milestone explicitly authorizes a policy change:

- `PipelineGuard/agent/decision.py`
- `PipelineGuard/agent/orchestrator.py`
- `PipelineGuard/agent/fix_generator.py`
- `PipelineGuard/agent/verifier.py`
- `PipelineGuard/agent/explanations.py`
- `PipelineGuard/agent/gemini_advisor.py`
- `PipelineGuard/audit/schemas.py`
- `PipelineGuard/audit/logger.py`

Do not replace these packages with mocks, duplicate their thresholds in the
dashboard, or fabricate missing evidence to satisfy their input schema.

## Current integration boundaries

The live path is:

```text
GitHub workflow read
  -> Detection Core POST /detect
  -> app/schemas/detection.py
  -> app/services/detection_contract.py
  -> app/services/assessment_adapter.py
  -> app/services/agentic_boundary.py
  -> authoritative PipelineGuard/agent/orchestrator.py
  -> persistence and dashboard response
```

The Detection Core contract is documented in
`docs/detection-core-contract.md`. The gateway accepts a minimal response with
only `status` and `risk_score`, but marks the assessment incomplete. Missing
confidence, reasons, model breakdown, or remediation evidence must remain
missing and normally cause `ESCALATE_TO_HUMAN`.

The authoritative agentic layer remains Gemini-disabled in the dashboard
integration. AUTO_FIX may produce a proposed diff, but this snapshot does not
apply it or create a pull request.

## Workstream 1 local provider

The local Hugging Face provider is implemented behind the explicit
`DETECTION_PROVIDER=local_huggingface` setting. The default remains
`DETECTION_PROVIDER=external`, preserving the existing HTTP Detection Core
path.

The local provider loads `FaizaML/pipelineguard-codebert-risk` lazily once per
process, performs CPU-safe `torch.no_grad()` inference, and returns only
model-derived `status` and `risk_score` evidence. Model failures return an
explicit unavailable/no-score response and never silently use demo output.

The model's original training input format, preprocessing, sequence length,
calibration, and thresholds remain unknown. The current workflow-text input
and three-state thresholds are documented, configurable PipelineGuard
integration policy rather than recovered model behavior.

## Standalone Detection Core service

`detection_core_service/` is a self-contained copyable service for running the
real model in GitHub Codespaces or another Docker-enabled/unrestricted Python
environment. It exposes `POST /detect` with the same request and response
contract expected by the main gateway. See its README for the exact virtualenv,
Docker, smoke-test, packaging, and gateway-connection commands.

The service is prepared but not deployed. The Replit runtime cannot install
PyTorch because of the package firewall restriction, and its Docker daemon is
unavailable. Do not repeat the failed installation commands or bypass those
restrictions.

The remaining Workstream 1 handoff needed to replace these policies is:

- verified model/checkpoint or reachable inference service
- model architecture or model ID
- input/feature format
- output schema and label mapping
- confidence/probability semantics
- score scale
- semantics for reasons, affected jobs, graph path, model breakdown, and remediation fields

## Frontend status

The Next.js frontend is under `frontend/`. Its `/analyze` screen calls
Archive A's `/api/v1/analyze` through `frontend/src/lib/api/client.ts` and
normalizes responses in `frontend/src/lib/contract/backend-adapt.ts`.
Incomplete evidence, unavailable/invalid Detection Core states, and the three
authoritative actions are rendered without creating fallback fixes or scores.
The older mock/replay adapter is isolated to the explicit Replay experience.

Do not begin frontend work by changing backend policy or persistence shapes.
Use the existing API responses as the integration surface.

## Recommended next milestone

Run the local provider against the real checkpoint in a controlled environment
and record operational behavior without presenting it as calibration. Then
recover or establish validated preprocessing and threshold evidence before
using the model for production decisions. Do not add GitHub writes or modify
the authoritative agentic packages.