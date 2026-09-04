# PipelineGuard Development Log

## Milestone 1 — Current Status

### Completed
- Created PROJECT_CONTEXT.md as the persistent project specification.
- Created a mock Workstream 1 risk assessment for a high-confidence, low-remediation-risk security regression.
- Created mocks/load_mock.py to validate the mock input.
- Created agent/decision.py with three deterministic decision outcomes:
  - AUTO_FIX
  - PROPOSE_WITH_CAUTION
  - ESCALATE_TO_HUMAN
- Created agent/fix_generator.py for the controlled security-tests restoration scenario.
- Created tests for the decision engine and fix generator.

### Current Test Status
18 tests passed.
0 tests failed.

Test command:
PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s tests -v

### Current AUTO_FIX Safety Policy
AUTO_FIX requires:
- confidence >= 0.90
- remediation_risk == "low"
- remediation_unambiguous == true
- required evidence and workflow context present

Missing or ambiguous information must fail safely.

### Current Fix Generator
The current generator:
- accepts only AUTO_FIX-eligible assessments
- restores the deleted security-tests job
- derives the job from assessment evidence/diff
- avoids unrelated workflow changes
- produces original content, fixed content, and unified diff
- does NOT claim verification

### Not Yet Implemented
- YAML parsing/validation
- yamllint verification
- workflow execution simulation
- Gemini integration/function calling
- PROPOSE_WITH_CAUTION fix behavior
- ESCALATE_TO_HUMAN behavior beyond deterministic decision selection
- English/Roman Urdu explanations
- audit trail
- GitHub integration
- pull request creation
- frontend

### Next Planned Milestone
Implement local verification of generated workflow changes:
- YAML parsing
- yamllint
- structured verification results
- accurate pass/fail reporting
- never claim verification when checks were not actually performed

## Milestone 2 — Local Verification

### Completed
- Created agent/verifier.py for local verification of generated workflow changes.
- Added YAML parsing with PyYAML.
- Added yamllint execution when the command is available.
- Added explicit skipped reporting when yamllint is unavailable.
- Added narrow change-scope verification for the security-tests restoration.
- Added structured check and overall verification results.
- Added requirements.txt with the PyYAML and yamllint dependencies.

### Verification Checks
- YAML parsing is required and fails the overall result when parsing fails.
- yamllint is optional: it reports passed when successful and skipped when unavailable.
- Change scope is required and checks that security-tests was restored with the expected configuration.
- Unrelated workflow changes cause the change-scope check to fail.

### Overall Status Rules
- Any failed check produces overall status `failed`.
- All required checks passing with linting skipped produces `passed_with_skips`.
- All checks passing produces `passed`.
- The verifier does not claim workflow execution, GitHub Actions success, production behavior, or full verification.

### Current Test Status
29 tests passed.
0 tests failed.

Test command:
PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s tests -v

### Current AUTO_FIX Verification Example
- YAML parsing: passed
- yamllint: passed, with non-blocking style warnings for the missing document marker and GitHub Actions `on` key
- Change scope: passed
- Overall status: `passed`

### Not Yet Implemented
- Workflow execution simulation
- Gemini integration/function calling
- English/Roman Urdu explanations
- Audit trail
- GitHub integration
- Pull request creation
- Frontend

### Next Planned Milestone
Add the next explicitly approved local agent capability while preserving deterministic safety checks and accurate verification reporting.

## Milestone 3 — Deterministic Explanation Layer

### Completed
- Created agent/explanations.py for deterministic dashboard-ready explanations.
- Added English and natural Pakistani Roman Urdu output.
- Added concise factual reasoning and developer review items.
- Added support for AUTO_FIX, PROPOSE_WITH_CAUTION, and ESCALATE_TO_HUMAN.
- Added accurate descriptions of passed, failed, skipped, and unknown verification results.
- Added safe handling for missing optional fix, verification, and assessment information.
- Avoided workflow execution, GitHub Actions, production, and hidden reasoning claims.

### Current Test Status
46 tests passed.
0 tests failed.

Test command:
PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s tests -v

### Explanation Safety Rules
- Explanations use only supplied assessment, decision, fix, and verification data.
- AUTO_FIX descriptions state the actual generated change and reported checks.
- PROPOSE_WITH_CAUTION descriptions warn that the change may be intentional and require human confirmation.
- ESCALATE_TO_HUMAN descriptions state uncertainty and do not invent a remediation.
- Missing verification is reported as unknown rather than passed.
- Skipped checks remain explicitly skipped and produce `passed_with_skips` context.

### Not Yet Implemented
- Separate persistent audit-trail storage
- Workflow execution simulation
- Gemini integration/function calling
- GitHub integration
- Pull request creation
- Frontend

### Next Planned Milestone
Add a separate structured audit-trail component that records the assessment, decision, generated diff, verification results, and final action without exposing hidden model reasoning.

## Milestone 4 — Structured Audit Trail

### Completed
- Created audit/schemas.py with serializable AuditRecord and AuditCheck dataclasses.
- Created audit/logger.py for record creation, JSON serialization, and local persistence.
- Added audit/audit package exports through audit/__init__.py.
- Recorded observable assessment, decision, fix, verification, and explanation outputs.
- Preserved failed, skipped, and missing verification states accurately.
- Prevented accidental overwrites by using unique audit filenames with collision suffixes.

### Audit Safety Rules
- Missing verification becomes `unknown`.
- Failed verification remains `failed`.
- Skipped verification remains `skipped` or `passed_with_skips` as supplied.
- No generated fix means `fix_generated` is false and no diff is fabricated.
- Optional fields are omitted when they were not supplied.
- Hidden chain-of-thought and private model reasoning are never recorded.

### Current Test Status
66 tests passed.
0 tests failed.

Test command:
PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s tests -v

### Not Yet Implemented
- Workflow execution simulation
- Gemini integration/function calling
- GitHub integration
- Pull request creation
- Frontend

## Milestone 6 — Optional Gemini Structured Advisor

### Completed
- Created agent/gemini_advisor.py for optional Gemini structured recommendations.
- Created tests/test_gemini_advisor.py with offline fake-client and boundary tests.
- Extended agent/orchestrator.py with an optional Gemini advisor path.
- Extended audit/schemas.py and audit/logger.py with Gemini-compatible observable metadata.
- Added the official `google-genai` SDK dependency to requirements.txt, pyproject.toml, and uv.lock.

### Advisor Architecture
Gemini receives a constrained assessment prompt and returns a schema-validated recommendation:
- recommended_action
- confidence
- rationale
- uncertainty
- requires_human_review

The advisor uses the official SDK lazily and supports injected clients for offline testing.
Function calling, GitHub, pull requests, frontend work, and workflow execution remain out of scope.

### Deterministic Safety Boundary
- The existing `decide()` result remains the deterministic authority.
- Gemini cannot make an escalation or caution decision less safe.
- Gemini may make an AUTO_FIX result more conservative.
- Invalid, malformed, unavailable, or failed Gemini output preserves the deterministic action.
- Audit metadata distinguishes deterministic action, Gemini recommendation, final enforced action, relationship, and advisor status.
- A recommendation requiring human review promotes an AUTO_FIX recommendation to PROPOSE_WITH_CAUTION.

### Configuration
- API key environment variable: `GEMINI_API_KEY`
- Optional model environment variable: `GEMINI_MODEL`
- API keys are never hardcoded, printed, or stored in audit records.

### Current Test Status
103 tests passed.
0 tests failed.

Test command:
PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s tests -v

The local demo continues to work without Gemini configured:
PYTHONDONTWRITEBYTECODE=1 python -m agent.orchestrator

### Known Limitations
- Gemini is optional and is not called by the default mock demo.
- Real API execution requires a configured `GEMINI_API_KEY`.
- No function calling has been implemented.
- No persistent Gemini request/response history is stored beyond observable audit metadata.
- The advisor is currently a recommendation layer, not an autonomous executor.
- Agent orchestration layer

## Milestone 5 — End-to-End Orchestrator

### Completed
- Created agent/orchestrator.py to connect the existing local components.
- Created tests/test_orchestrator.py with deterministic integration and CLI tests.
- Added the `orchestrate()` callable and `python -m agent.orchestrator` demo entry point.
- Added one structured OrchestrationResult exposing assessment, decision, fix, verification, explanation, audit, errors, and review state.
- Preserved existing decision, fix-generation, verification, explanation, and audit implementations without duplicating their logic.

### End-to-End Flow
The orchestrator runs:
assessment → decision → fix generation → verification → explanation → audit → complete result.

Only `AUTO_FIX` reaches fix generation and verification. `PROPOSE_WITH_CAUTION` and
`ESCALATE_TO_HUMAN` stop before those stages and return honest missing-fix and unknown-verification states.

### Error and Safety Behavior
- Invalid assessments produce a controlled escalation with a visible error.
- Fix-generation, verification, explanation, and audit-persistence failures remain visible in the result.
- Failed verification remains failed and requires human review.
- Missing verification remains unknown.
- No diff is fabricated when no fix was generated.
- Audit records continue to exclude hidden chain-of-thought and private model reasoning.
- No new dependencies were added.

### Current Test Status
81 tests passed.
0 tests failed.

Test command:
PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s tests -v

### Not Yet Implemented
- Workflow execution simulation
- Gemini integration/function calling
- GitHub integration
- Pull request creation
- Frontend