# PipelineGuard Standalone Detection Core

This directory is a small, standalone HTTP service for running the real
Hugging Face detector outside the main PipelineGuard Replit environment.

It exposes the same contract expected by the main gateway:

```http
POST /detect
```

Request:

```json
{
  "repo": "owner/repository",
  "workflow_run_id": "run-id",
  "diff": "workflow content"
}
```

Successful response:

```json
{
  "status": "clean",
  "risk_score": 0.12
}
```

`risk_score` is always a finite probability in the `0–1` range. Model loading,
invalid output, inference failures, and empty workflow content produce an HTTP
failure response without a fabricated score.

## Model and policy

The service uses:

```text
FaizaML/pipelineguard-codebert-risk
```

Verified model facts:

- `RobertaForSequenceClassification`
- Label `0` is benign
- Label `1` is risky
- Risk probability is `softmax(logits, dim=-1)[0, 1]`

The following are provisional PipelineGuard integration policy, not recovered
training behavior:

- Workflow text as the model input
- Line-ending normalization
- 512-token maximum length
- Max-length padding
- Truncation enabled
- `0.20` clean threshold
- `0.80` malicious threshold

Override these values with environment variables when testing a different
policy. Do not treat the thresholds as calibrated until they are validated
against real labeled examples.

## GitHub Codespaces quick start

From inside this directory:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

The first `POST /detect` request downloads and loads the model. The model is
then reused by the process. Do not expose the service publicly without
appropriate network access controls.

Test it with:

```bash
curl -X POST http://localhost:8001/detect \
  -H 'Content-Type: application/json' \
  -d '{"repo":"demo/repo","workflow_run_id":"codespaces-smoke","diff":"name: CI\njobs:\n  build:\n    runs-on: ubuntu-latest"}'
```

## Docker

Build and run from inside this directory:

```bash
docker build -t pipelineguard-detection-core .
docker run --rm -p 8001:8001 pipelineguard-detection-core
```

## Connect the main PipelineGuard application

After this service is reachable from the gateway, configure the main
PipelineGuard application:

```env
DETECTION_PROVIDER=external
DETECTION_CORE_URL=http://<detection-core-host>:8001
```

The main application will continue to validate the response, pass it through
the canonical assessment adapter and authoritative Workstream 2 boundary, and
persist the result.

## Package or copy this service

From the PipelineGuard project root:

```bash
zip -r detection_core_service.zip detection_core_service/
```

Or copy the complete directory into another environment:

```bash
cp -a detection_core_service /path/to/another/workspace/
```