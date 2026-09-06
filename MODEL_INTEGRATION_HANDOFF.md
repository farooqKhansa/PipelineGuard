# PipelineGuard Model Integration Handoff

This snapshot is the current working state before integrating the real Hugging
Face Detection Core model. Do not redo the frontend graft, replace Archive A,
or modify the authoritative Workstream 2 packages.

## Current architecture

```text
Frontend
  -> POST /api/v1/analyze
  -> Archive A FastAPI gateway
  -> POST {DETECTION_CORE_URL}/detect
  -> Detection Core response
  -> canonical assessment adapter
  -> authoritative PipelineGuard/agent + audit
  -> frontend-compatible response
```

The Detection Core request body is:

```json
{
  "repo": "owner/repository",
  "workflow_run_id": "run-id",
  "diff": "complete workflow content"
}
```

For `/api/v1/analyze`, `diff` is the decoded content of the first GitHub
Actions workflow file found. The live endpoint disables demo fallback.

## Frontend status

The reusable Archive B Next.js frontend is under `frontend/`. Its live
`/analyze` page calls Archive A's `/api/v1/analyze` through
`frontend/src/lib/api/client.ts` and adapts the response with
`frontend/src/lib/contract/backend-adapt.ts`.

Replay/mock data remains isolated. The old local frontend analyzer is not used
by the live path. `NEXT_PUBLIC_API_BASE` defaults to
`http://localhost:8000/api/v1`.

## Real model

Hugging Face repository:

```text
FaizaML/pipelineguard-codebert-risk
```

Verified model facts:

- Architecture: `RobertaForSequenceClassification`
- Labels: `0 = benign`, `1 = risky`
- Tokenizer: `RobertaTokenizer`
- Config-consistent risky probability: `softmax(logits)[1]`
- Model files: `model.safetensors`, `config.json`, `tokenizer.json`,
  `tokenizer_config.json`

The HF repository does not establish the model's training input format,
training-time token limit, padding behavior, inference preprocessing,
probability thresholds, or mapping from binary output to
`clean/suspicious/malicious`.

The repository search also found no local training script, inference script,
notebook, dataset preparation code, Trainer configuration, or calibration
artifacts.

## Current decision

`MODEL_CONTRACT_PARTIALLY_RECOVERED_WITH_EXPLICIT_INTEGRATION_POLICY`

The model is now integrated through the opt-in local provider
`DETECTION_PROVIDER=local_huggingface`. The implementation does not claim to
have recovered the model's original training behavior. Workflow-text input,
512-token inference, max-length padding, truncation, and the three-state
thresholds are configurable PipelineGuard integration policy.

The local provider returns only `status` and `risk_score`, preserves the
existing `0–1` contract, loads once per process, and returns unavailable/no
score on model failures. The external HTTP Detection Core remains available
and is still the default provider.

## Files that must not be modified

- `PipelineGuard/agent/decision.py`
- `PipelineGuard/agent/orchestrator.py`
- `PipelineGuard/agent/fix_generator.py`
- `PipelineGuard/agent/verifier.py`
- `PipelineGuard/agent/explanations.py`
- `PipelineGuard/agent/gemini_advisor.py`
- `PipelineGuard/audit/schemas.py`
- `PipelineGuard/audit/logger.py`

## Verification

Focused Detection Core tests pass:

```text
38 passed, 1 warning
```

Command:

```bash
PYTHONPATH=.:./PipelineGuard \
python -m pytest \
tests/test_detection_core_contract.py \
tests/test_dashboard_contract.py \
tests/test_agentic_boundary.py -q
```

Earlier frontend verification also passed:

- `npm run typecheck`
- `npm run build`

The full backend and Workstream 2 suites retain known baseline failures; do
not change their tests or authoritative files to hide them.

## Next implementation step

Run the local provider against the real checkpoint in a controlled environment,
then obtain original preprocessing or calibration evidence before treating the
current integration policy as anything more than provisional. The frontend and
Workstream 2 agentic layer remain unchanged.