# PipelineGuard — Next Chat Handoff

You are continuing the existing PipelineGuard project. This archive is the
authoritative current project state. Start from these files; do not reconstruct
the architecture from older archives and do not perform a broad inspection.

## Read first

Read these files in order:

1. `NEXT_REPLIT_CHAT_PROMPT.md`
2. `MODEL_INTEGRATION_HANDOFF.md`
3. `PROJECT_STATE.md`
4. `CONTINUE_DEVELOPMENT.md`
5. `docs/detection-core-contract.md`
6. `docs/model-integration-policy.md`

Then inspect only the files required for the user's requested milestone.

## Current state

Implemented:

- FastAPI dashboard backend and persistence
- Strict Detection Core contract
- `/api/v1/analyze` live flow
- GitHub workflow read path
- Canonical assessment adapter
- Authoritative Workstream 2 agentic boundary
- Frontend graft under `frontend/`
- Demo/live separation
- Local Hugging Face Detection Core provider
- Focused Detection Core and local-provider tests

The local model integration targets:

```text
FaizaML/pipelineguard-codebert-risk
```

The default provider remains external:

```env
DETECTION_PROVIDER=external
```

The local provider is explicitly enabled with:

```env
DETECTION_PROVIDER=local_huggingface
```

It lazily loads `RobertaTokenizer` and
`RobertaForSequenceClassification` once per process, runs CPU-safe inference
under `torch.no_grad()`, and calculates:

```python
softmax(logits, dim=-1)[0, 1]
```

The local result preserves the existing:

```json
{
  "status": "clean | suspicious | malicious",
  "risk_score": 0.0
}
```

contract. It returns no fabricated confidence, reasons, graph data, model
breakdown, diff, or remediation evidence.

## Important honesty boundary

Verified model facts:

- Architecture: `RobertaForSequenceClassification`
- Labels: `0 = benign`, `1 = risky`
- Tokenizer: `RobertaTokenizer`
- Risk probability: `softmax(logits)[1]`
- Tokenizer configuration advertises maximum length `512`

Not recovered from the original training process:

- Input representation
- Preprocessing
- Training sequence length
- Padding and truncation behavior
- Calibration
- Three-state thresholds

The current workflow-text input, 512-token setting, padding/truncation policy,
and `0.20` / `0.80` thresholds are configurable PipelineGuard integration
policy. They must not be described as trained, calibrated, validated, or
recovered model behavior.

## Protected files

Do not modify the authoritative Workstream 2 files:

- `PipelineGuard/agent/decision.py`
- `PipelineGuard/agent/orchestrator.py`
- `PipelineGuard/agent/fix_generator.py`
- `PipelineGuard/agent/verifier.py`
- `PipelineGuard/agent/explanations.py`
- `PipelineGuard/agent/gemini_advisor.py`
- `PipelineGuard/audit/schemas.py`
- `PipelineGuard/audit/logger.py`

Do not revive the old Archive B backend, duplicate agentic policy, fabricate
evidence, or silently use demo predictions.

## Verification

Focused tests:

```bash
AGENTIC_LAYER_PATH=./PipelineGuard \
PYTHONPATH=.:./PipelineGuard \
python -m pytest \
  tests/test_huggingface_detector.py \
  tests/test_detection_core_contract.py \
  tests/test_dashboard_contract.py \
  tests/test_agentic_boundary.py -q
```

The current snapshot passed these focused tests with mocked model loading.
The real checkpoint has not been downloaded. Install dependencies from
`requirements.txt` in an environment that permits the PyTorch wheel before
running a real-model smoke test.

## Current runtime blocker

The Replit runtime was checked after implementation:

- Python `3.11.14` is compatible.
- `torch`, `transformers`, and `safetensors` are not installed.
- The supported package installation path received HTTP 403 from the package
  firewall while retrieving the PyTorch wheel.
- No matching installed Nix packages are available.
- Docker is installed, but its daemon is unavailable in this workspace.

Do not repeat the failed PyTorch installation commands or attempt to bypass
package security restrictions. The next practical step is to run the existing
detector in a Docker-enabled CPU environment while preserving the Detection
Core HTTP contract.

## Standalone Detection Core service

The project now contains `detection_core_service/`, a self-contained HTTP
service intended for GitHub Codespaces or another Docker-enabled or unrestricted
Python environment. It includes its own model detector, schemas, tests,
requirements, Dockerfile, `.env.example`, and README.

It exposes:

```text
POST /detect
```

The successful response remains the existing Detection Core contract:

```json
{
  "status": "clean | suspicious | malicious",
  "risk_score": 0.0
}
```

It returns an HTTP failure without a score when model loading, inference, or
input validation fails. It does not modify the main gateway or the
authoritative Workstream 2 packages.

## Recommended next milestone

Copy `detection_core_service/` into GitHub Codespaces, install its dependencies,
run one real checkpoint smoke test, and connect the main gateway using
`DETECTION_PROVIDER=external` and `DETECTION_CORE_URL`. Record load/inference
behavior, then recover or establish evidence for the original preprocessing
and calibration before treating the provisional status thresholds as
production policy. Do not add GitHub writes or modify the authoritative
agentic packages.