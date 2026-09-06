# PipelineGuard

PipelineGuard is an AI-assisted security and reliability platform for CI/CD pipelines. It analyzes workflow changes, combines model-based detection with deterministic checks, and helps teams understand what is risky, why it is risky, and what should happen next.

The project is built around a simple principle:

> AI can assist with security decisions, but it should not silently overrule safety boundaries.

## What PipelineGuard does

PipelineGuard brings several parts of a CI/CD security workflow together:

* **Pipeline analysis** — examines workflow configuration and related changes for risky patterns.
* **Detection Core** — provides the model-backed detection service through a defined integration contract.
* **Agentic decision layer** — evaluates findings and determines the appropriate action instead of automatically proposing fixes for everything.
* **Fix generation** — creates a remediation when the evidence is strong enough.
* **Verification** — checks generated changes before they are presented as safe.
* **Audit trail** — records decisions, confidence, verification results, and supporting evidence.
* **Dashboard and replay** — provides interfaces for reviewing findings, reasoning, fixes, and previous analyses.

## The agentic safety boundary

The agentic layer is intentionally conservative. It separates decisions into three paths.

### Auto-fix

Used when confidence is high and the proposed change is low risk.

For example, restoring a test or validation gate that was accidentally removed from a workflow.

### Propose with caution

Used when a finding is well supported but the proposed change could have a meaningful operational impact.

For example, reverting a permission change that may be dangerous while acknowledging that the change could have been intentional.

### Escalate to a human

Used when the evidence is incomplete, conflicting, or ambiguous.

PipelineGuard does not pretend to know more than it does.

This safety boundary is enforced by application logic and verification rather than relying on a model response alone. Gemini is therefore used as an advisory component, not as the final authority.

## Architecture

```text
PipelineGuard
├── app/                       FastAPI application
│   ├── routers/               API endpoints
│   ├── services/              Application and analysis services
│   ├── models/                Database models
│   └── schemas/               API/data schemas
│
├── detection_core_service/    Model-backed detection service
├── agent/                     Agentic decision and fix-generation layer
├── audit/                     Audit logging and schemas
├── mocks/                     Test fixtures
├── alembic/                   Database migrations
├── tests/                     Backend and integration tests
├── frontend/                  Next.js dashboard
└── docs/                      Architecture and integration documentation
```

## Technology

### Backend

* Python
* FastAPI
* SQLAlchemy
* Alembic
* Pydantic

### Detection and AI

* Hugging Face model integration
* Gemini advisory layer
* Deterministic policy and verification checks

### Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS

### Testing

* pytest
* API and integration tests
* Detection Core contract tests
* Agentic boundary tests

## Local setup

### 1. Clone the repository

```bash
git clone https://github.com/farooqKhansa/PipelineGuard.git
cd PipelineGuard
```

### 2. Create a Python environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install backend dependencies

```bash
pip install -r requirements.txt
```

The Detection Core service has its own dependencies:

```bash
pip install -r detection_core_service/requirements.txt
```

### 4. Configure environment variables

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env.local
```

Review the configuration before starting the services. Local environment files and secrets are intentionally excluded from version control.

### 5. Start the backend

```bash
uvicorn app.main:app --reload
```

### 6. Start the frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Use the local address printed by Next.js to open the dashboard.

### 7. Detection Core

The Detection Core service can be run independently when testing model-backed analysis.

See:

* `detection_core_service/README.md`
* `docs/detection-core-contract.md`

for service and integration details.

## Running the tests

From the repository root:

```bash
source .venv/bin/activate
PYTHONPATH="$PWD" pytest -q
```

## Model integration

PipelineGuard is designed so that model artifacts do not need to live in the repository.

Model weights and local caches are excluded from version control, while the application communicates with the detection layer through an explicit contract. This keeps model-specific implementation separate from the core application and decision flow.

For more information, see:

* `MODEL_INTEGRATION_HANDOFF.md`
* `docs/model-integration-policy.md`
* `docs/detection-core-contract.md`

## Development notes

The repository also contains documentation for continuing development:

* `PROJECT_STATE.md` — current project state and implementation context.
* `CONTINUE_DEVELOPMENT.md` — notes for continuing development.
* `NEXT_REPLIT_CHAT_PROMPT.md` — context for continuing work in Replit.

## Security and responsible use

PipelineGuard is intended to assist with CI/CD security review. It should not be treated as an unconditional replacement for human review.

Ambiguous or high-impact changes should remain visible to a human reviewer. The system is designed to prefer caution when the available evidence is insufficient.

## Project status

This repository contains the consolidated PipelineGuard application, including the FastAPI backend, Next.js frontend, Detection Core integration, agentic safety layer, audit components, database migrations, test fixtures, documentation, and automated tests.

The repository history preserves the original PipelineGuard baseline while adding the consolidated application as the current project state.
