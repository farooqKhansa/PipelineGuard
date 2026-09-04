# PipelineGuard — Workstream 2 Agentic Layer

## Project

PipelineGuard is an AI-powered security system for detecting and responding to security regressions in CI/CD pipelines, particularly GitHub Actions workflows.

The system detects potentially dangerous changes such as:
- removed security gates
- widened permissions
- disabled security scans
- unsafe workflow configuration changes

The overall project has multiple workstreams.

## Workstream 1 — Detection Core

Workstream 1 analyzes a CI/CD workflow and produces a structured risk assessment.

Workstream 2 does NOT implement the detection core.

Workstream 2 consumes its structured output.

For development, Workstream 2 will initially use mocked Workstream 1 input.

## Workstream 2 — Agentic Layer

This is the component we are implementing.

Its responsibility is to decide what should happen after a security regression has been detected.

The agent must demonstrate genuine judgment rather than automatically proposing a fix for every issue.

It must recognize when it has enough evidence to act and when it should defer to a human.

## Three Decision Paths

### 1. AUTO_FIX

Conditions:
- high confidence
- low-risk / narrowly scoped change
- remediation is sufficiently unambiguous

The agent may generate a fix.

The fix must then pass actual verification before being described as verified.

Example:
A security test gate was accidentally removed from a workflow and restoring it is clearly the intended remediation.

### 2. PROPOSE_WITH_CAUTION

Conditions:
- high confidence
- potentially high-impact change
- the change may be legitimate or intentional

The agent may prepare a proposed fix, but must clearly warn the developer that the change may be intentional.

It must NOT automatically merge or apply the change.

It should explain the tradeoff and request human confirmation.

Example:
A workflow permission scope has been widened and reverting it may affect legitimate functionality.

### 3. ESCALATE_TO_HUMAN

Conditions:
- low confidence
- ambiguous situation
- insufficient context
- conflicting evidence
- multiple plausible remediations
- potentially unsafe automatic action

The agent must NOT invent a fix.

It should explain:
- what is uncertain
- why it cannot safely decide
- what a human should investigate

## Agentic Architecture

The intended architecture uses Gemini with function calling.

Gemini should be used for reasoning/decision-making and controlled tool selection.

Do not use a heavy orchestration framework such as LangChain unless there is a compelling technical reason.

The application should keep deterministic safety checks around model-generated decisions.

The model must not be trusted blindly.

Model output must be validated against structured schemas.

## Input Contract

Workstream 2 receives a structured risk assessment.

The project specification uses fields such as:

- risk_score
- confidence
- reasons
- affected_jobs
- graph_path
- model_breakdown
- repo
- workflow_run_id
- diff

Additional workflow/repository context may be provided when available.

Do not invent information that is not present in the input.

## Output Contract

The eventual agent result should contain:

- action
- confidence
- fix_diff when a fix is proposed
- verification status
- English explanation
- Roman Urdu explanation
- reasoning/audit information

The action must represent one of:

AUTO_FIX
PROPOSE_WITH_CAUTION
ESCALATE_TO_HUMAN

Verification must reflect actual checks performed.

Never claim a fix is verified if the corresponding check was not actually run.

## Fix Generation

Fixes must be narrowly scoped.

The agent must not make unrelated workflow changes.

A proposed fix should produce a clear diff.

## Verification

At minimum, workflow YAML should eventually be checked using:
- YAML parsing
- yamllint

nektos/act may optionally be used later to simulate workflow execution.

If simulation is not performed, the result must explicitly say so.

## Explanations

The agent eventually produces:

1. English explanation
2. Natural Roman Urdu explanation

The explanation should cover:
- what changed
- why it is risky
- what is being proposed
- what the developer should check

Roman Urdu should be natural rather than a literal word-for-word translation.

## GitHub Integration

GitHub integration will be added later.

It may eventually:
- retrieve workflow files
- create a branch
- commit a proposed fix
- create a pull request

Do not implement GitHub integration until the local agent flow works.

## Audit Trail

The system should record:
- input/risk information
- selected decision
- confidence
- reasoning
- generated diff
- verification results
- final action

This information will eventually be consumed by the frontend/reasoning dashboard.

## Development Strategy

We build incrementally.

Milestone 1:
Mock input → agent decision → AUTO_FIX → controlled fix generation → structured result.

Milestone 2:
Actual YAML parsing and verification.

Milestone 3:
English + Roman Urdu explanation and audit trail.

Milestone 4:
PROPOSE_WITH_CAUTION.

Milestone 5:
ESCALATE_TO_HUMAN.

Milestone 6:
GitHub integration and pull request creation.

Milestone 7:
Optional workflow simulation using nektos/act.

## Important Constraints

Do not implement Workstream 1, Workstream 3, or Workstream 4.

Do not build the entire application at once.

Do not modify unrelated files.

Do not claim functionality exists unless it has actually been implemented and tested.

Before making architectural changes, check PROJECT_CONTEXT.md.

This file is the persistent source of truth for the PipelineGuard Workstream 2 implementation.