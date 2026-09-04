"""Deterministic end-to-end orchestration for PipelineGuard Workstream 2."""

from dataclasses import asdict, dataclass, is_dataclass
import json
from pathlib import Path
import sys
from typing import Any, Mapping

from agent.decision import (
    AUTO_FIX,
    DecisionResult,
    ESCALATE_TO_HUMAN,
    PROPOSE_WITH_CAUTION,
    decide,
)
from agent.explanations import explain
from agent.fix_generator import generate_fix
from agent.gemini_advisor import (
    GeminiAdvisorError,
    GeminiResponseError,
    STATUS_INVALID,
    STATUS_UNAVAILABLE,
    enforce_recommendation,
    unavailable_boundary,
)
from agent.verifier import verify_workflow
from audit.logger import create_audit_record, write_audit_record


DEFAULT_WORKFLOW = """name: CI

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


@dataclass(frozen=True)
class OrchestrationResult:
    """The complete observable result of one local agent run."""

    assessment: Any = None
    decision: Any = None
    fix: Any = None
    verification: Any = None
    explanation: Any = None
    audit: Any = None
    gemini: Any = None
    audit_path: Path | None = None
    audit_persisted: bool | None = None
    human_review_required: bool = False
    warnings: tuple[str, ...] = ()
    error: str | None = None

    @property
    def deterministic_action(self) -> str | None:
        if self.decision is None:
            return None
        if isinstance(self.decision, Mapping):
            return self.decision.get("action")
        return getattr(self.decision, "action", None)

    @property
    def action(self) -> str | None:
        if self.gemini is not None:
            return self.gemini.final_enforced_action
        return self.deterministic_action

    def to_dict(self) -> dict[str, Any]:
        result = {
            "assessment": _serialize(self.assessment),
            "decision": _serialize(self.decision),
            "fix": _serialize(self.fix),
            "verification": _serialize(self.verification),
            "explanation": _serialize(self.explanation),
            "audit": _serialize(self.audit),
            "gemini": _serialize(self.gemini),
            "human_review_required": self.human_review_required,
        }
        if self.audit_path is not None:
            result["audit_path"] = str(self.audit_path)
        if self.audit_persisted is not None:
            result["audit_persisted"] = self.audit_persisted
        if self.error is not None:
            result["error"] = self.error
        if self.warnings:
            result["warnings"] = list(self.warnings)
        return result


def _serialize(value: Any) -> Any:
    if value is None:
        return None
    to_dict = getattr(value, "to_dict", None)
    if callable(to_dict):
        return to_dict()
    if is_dataclass(value):
        return asdict(value)
    if isinstance(value, Mapping):
        return dict(value)
    return value


def _error_text(stage: str, error: Exception) -> str:
    detail = str(error).strip()
    suffix = f": {detail}" if detail else ""
    return f"{stage} failed ({type(error).__name__}){suffix}."


def _action_of(decision: Any) -> str | None:
    if decision is None:
        return None
    if isinstance(decision, Mapping):
        action = decision.get("action")
    else:
        action = getattr(decision, "action", None)
    return str(action) if action is not None else None


def _human_review_required(
    action: str | None,
    verification: Any,
    error: str | None,
) -> bool:
    if error or action in {PROPOSE_WITH_CAUTION, ESCALATE_TO_HUMAN}:
        return True
    if verification is None:
        return action == AUTO_FIX
    status = (
        verification.get("status")
        if isinstance(verification, Mapping)
        else getattr(verification, "status", None)
    )
    return status != "passed"


def _decision_for_explanation(
    decision: Any,
    final_action: str | None,
) -> Any:
    """Keep explanations aligned with a more-conservative enforced action."""

    if decision is None or final_action is None:
        return decision
    if _action_of(decision) == final_action:
        return decision
    confidence = (
        decision.get("confidence")
        if isinstance(decision, Mapping)
        else getattr(decision, "confidence", 0.0)
    )
    if not isinstance(confidence, (int, float)) or isinstance(confidence, bool):
        confidence = 0.0
    return DecisionResult(
        action=final_action,
        confidence=float(confidence),
        reason=(
            "The deterministic safety boundary enforced "
            f"{final_action} after the Gemini recommendation."
        ),
    )


def orchestrate(
    assessment: Any,
    workflow_content: str,
    *,
    gemini_advisor: Any = None,
    audit_directory: str | Path | None = None,
    audit_id: str | None = None,
    timestamp: str | None = None,
) -> OrchestrationResult:
    """Run the existing local components without duplicating their logic."""

    errors: list[str] = []
    decision = None
    fix = None
    verification = None
    explanation = None
    audit = None
    gemini = None
    audit_path = None
    audit_persisted = None
    warnings: list[str] = []

    if not isinstance(assessment, Mapping):
        errors.append(
            "Invalid assessment: the risk assessment must be a structured object."
        )

    try:
        decision = decide(assessment)
    except Exception as error:
        errors.append(_error_text("Decision", error))

    action = _action_of(decision)
    if decision is not None:
        if gemini_advisor is None:
            gemini = unavailable_boundary(decision)
            warnings.append(
                "Gemini advisor not configured; deterministic action preserved."
            )
        else:
            try:
                recommendation = gemini_advisor.advise(
                    assessment,
                    workflow_content,
                )
            except GeminiResponseError:
                gemini = enforce_recommendation(
                    decision,
                    status=STATUS_INVALID,
                    error="Gemini returned invalid structured output.",
                )
                warnings.append(
                    "Gemini recommendation was invalid; deterministic action preserved."
                )
            except GeminiAdvisorError:
                gemini = enforce_recommendation(
                    decision,
                    status=STATUS_UNAVAILABLE,
                    error="Gemini advisor was unavailable; deterministic action preserved.",
                )
                warnings.append(
                    "Gemini advisor was unavailable; deterministic action preserved."
                )
            except Exception:
                gemini = enforce_recommendation(
                    decision,
                    status=STATUS_UNAVAILABLE,
                    error="Gemini advisor failed; deterministic action preserved.",
                )
                warnings.append(
                    "Gemini advisor failed; deterministic action preserved."
                )
            else:
                gemini = enforce_recommendation(decision, recommendation)
                action = gemini.final_enforced_action
        if gemini is not None:
            action = gemini.final_enforced_action

    if action == AUTO_FIX:
        try:
            fix = generate_fix(workflow_content, assessment)
        except Exception as error:
            errors.append(_error_text("Fix generation", error))
        else:
            if fix is not None:
                try:
                    verification = verify_workflow(
                        fix.original_workflow,
                        fix.fixed_workflow,
                    )
                except Exception as error:
                    errors.append(_error_text("Verification", error))
    elif action in {PROPOSE_WITH_CAUTION, ESCALATE_TO_HUMAN}:
        # These actions intentionally do not generate or verify an automatic fix.
        pass

    if decision is not None:
        try:
            explanation = explain(
                assessment=assessment,
                decision=_decision_for_explanation(decision, action),
                fix=fix,
                verification=verification,
            )
        except Exception as error:
            errors.append(_error_text("Explanation", error))

    try:
        audit = create_audit_record(
            assessment=assessment,
            decision=decision,
            fix=fix,
            verification=verification,
            explanation=explanation,
            gemini=gemini,
            audit_id=audit_id,
            timestamp=timestamp,
        )
    except Exception as error:
        errors.append(_error_text("Audit creation", error))
    else:
        if audit_directory is not None:
            try:
                audit_path = write_audit_record(audit, audit_directory)
                audit_persisted = True
            except Exception as error:
                audit_persisted = False
                errors.append(_error_text("Audit persistence", error))

    error_text = " ".join(errors) if errors else None
    return OrchestrationResult(
        assessment=assessment,
        decision=decision,
        fix=fix,
        verification=verification,
        explanation=explanation,
        audit=audit,
        gemini=gemini,
        audit_path=audit_path,
        audit_persisted=audit_persisted,
        human_review_required=_human_review_required(
            action,
            verification,
            error_text,
        ),
        warnings=tuple(warnings),
        error=error_text,
    )


run_pipeline = orchestrate


def run_mock_flow(
    *,
    audit_directory: str | Path | None = None,
) -> OrchestrationResult:
    """Run the current validated Workstream 1 mock through every local stage."""

    from mocks.load_mock import load_and_validate_mock

    return orchestrate(
        load_and_validate_mock(),
        DEFAULT_WORKFLOW,
        audit_directory=audit_directory,
    )


def _demo_summary(result: OrchestrationResult) -> dict[str, Any]:
    return {
        "stages": [
            "assessment",
            "decision",
            "fix",
            "verification",
            "explanation",
            "audit",
        ],
        "action": result.action,
        "deterministic_action": result.deterministic_action,
        "fix_generated": result.fix is not None,
        "verification_status": (
            result.verification.status if result.verification is not None else "unknown"
        ),
        "english_explanation": result.explanation is not None,
        "roman_urdu_explanation": result.explanation is not None,
        "audit_created": result.audit is not None,
        "audit_id": result.audit.audit_id if result.audit is not None else None,
        "gemini_status": result.gemini.status if result.gemini is not None else None,
        "gemini_relationship": (
            result.gemini.relationship if result.gemini is not None else None
        ),
        "human_review_required": result.human_review_required,
        "error": result.error,
    }


def main() -> int:
    try:
        result = run_mock_flow()
    except Exception as error:
        print(
            json.dumps(
                {"error": _error_text("Mock flow", error)},
                indent=2,
            ),
            file=sys.stderr,
        )
        return 1

    print(json.dumps(_demo_summary(result), indent=2))
    return 0 if result.error is None else 1


if __name__ == "__main__":
    sys.exit(main())