"""Deterministic decision policy for the PipelineGuard agentic layer."""

from dataclasses import dataclass
import math
from typing import Any, Mapping


AUTO_FIX = "AUTO_FIX"
PROPOSE_WITH_CAUTION = "PROPOSE_WITH_CAUTION"
ESCALATE_TO_HUMAN = "ESCALATE_TO_HUMAN"

CONFIDENCE_THRESHOLD = 0.90

REQUIRED_ASSESSMENT_FIELDS = (
    "risk_score",
    "confidence",
    "reasons",
    "affected_jobs",
    "graph_path",
    "model_breakdown",
    "repo",
    "workflow_run_id",
    "diff",
)

REQUIRED_MODEL_FIELDS = (
    "pipeline_score",
    "code_score",
    "combined_score",
)


@dataclass(frozen=True)
class DecisionResult:
    """The action permitted by the deterministic safety policy."""

    action: str
    confidence: float
    reason: str


def _numeric_score(value: Any) -> bool:
    """Return whether value is a finite score between zero and one."""

    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
        and 0.0 <= value <= 1.0
    )


def _escalate(confidence: float, reason: str) -> DecisionResult:
    return DecisionResult(ESCALATE_TO_HUMAN, confidence, reason)


def decide(assessment: Mapping[str, Any]) -> DecisionResult:
    """Select an action without generating or applying a fix.

    ``risk_score`` represents the detected security regression severity. The
    separate ``remediation_risk`` field represents the impact of changing the
    workflow, so a high-severity issue can still qualify for a low-impact fix.
    """

    if not isinstance(assessment, Mapping):
        return _escalate(0.0, "The risk assessment must be a structured object.")

    confidence_value = assessment.get("confidence", 0.0)
    confidence = (
        float(confidence_value) if _numeric_score(confidence_value) else 0.0
    )

    missing_fields = [
        field for field in REQUIRED_ASSESSMENT_FIELDS if field not in assessment
    ]
    if missing_fields:
        return _escalate(
            confidence,
            "Required assessment information is missing: "
            + ", ".join(missing_fields)
            + ".",
        )

    if not _numeric_score(assessment["risk_score"]):
        return _escalate(
            confidence,
            "The risk_score is missing or is not a valid numeric score.",
        )

    if not _numeric_score(confidence_value):
        return _escalate(
            0.0,
            "The confidence value is missing or is not a valid numeric score.",
        )

    model_breakdown = assessment["model_breakdown"]
    if not isinstance(model_breakdown, Mapping):
        return _escalate(confidence, "model_breakdown must be a structured object.")

    missing_model_fields = [
        field for field in REQUIRED_MODEL_FIELDS if field not in model_breakdown
    ]
    if missing_model_fields:
        return _escalate(
            confidence,
            "Required model breakdown information is missing: "
            + ", ".join(missing_model_fields)
            + ".",
        )

    if not assessment.get("reasons") or not assessment.get("diff"):
        return _escalate(
            confidence,
            "The assessment does not contain enough evidence or a relevant diff.",
        )

    remediation_risk = assessment.get("remediation_risk")
    if remediation_risk not in {"low", "high"}:
        return _escalate(
            confidence,
            "Remediation impact is missing or ambiguous; a human must review it.",
        )

    if assessment.get("remediation_unambiguous") is not True:
        return _escalate(
            confidence,
            "The remediation is not explicitly unambiguous; a human must review it.",
        )

    if confidence < CONFIDENCE_THRESHOLD:
        return _escalate(
            confidence,
            "Confidence is below the safe AUTO_FIX threshold.",
        )

    if remediation_risk == "low":
        return DecisionResult(
            AUTO_FIX,
            confidence,
            "High confidence and a narrowly scoped, unambiguous low-risk remediation permit AUTO_FIX.",
        )

    return DecisionResult(
        PROPOSE_WITH_CAUTION,
        confidence,
        "Confidence is high, but the remediation may have significant impact and requires human confirmation.",
    )