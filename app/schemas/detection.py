"""Strict Detection Core response contract.

The external service owns detection semantics. This schema validates only the
transport contract and preserves optional evidence exactly as supplied. It
does not infer missing Workstream 1 evidence or make policy decisions.
"""

from __future__ import annotations

from math import isfinite
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictFloat, StrictInt, field_validator


DetectionStatus = Literal["clean", "suspicious", "malicious"]
RemediationRisk = Literal["low", "medium", "high"]
Numeric = StrictFloat | StrictInt

CANONICAL_EVIDENCE_FIELDS = (
    "risk_score",
    "confidence",
    "reasons",
    "affected_jobs",
    "graph_path",
    "model_breakdown",
    "diff",
    "remediation_risk",
    "remediation_unambiguous",
)


class DetectionCoreResponse(BaseModel):
    """Version-one Detection Core response.

    ``extra='allow'`` keeps forward-compatible evidence visible while all
    fields currently understood by the gateway retain strict validation.
    """

    model_config = ConfigDict(extra="allow")

    status: DetectionStatus
    risk_score: Numeric = Field(..., description="Finite probability in the 0–1 range.")
    confidence: Numeric | None = None
    reasons: list[Any] | None = None
    affected_jobs: list[str] | None = None
    graph_path: list[Any] | None = None
    model_breakdown: dict[str, Any] | None = None
    diff: str | None = None
    remediation_risk: RemediationRisk | None = None
    remediation_unambiguous: StrictBool | None = None

    @field_validator("risk_score", "confidence")
    @classmethod
    def validate_probability(cls, value: Numeric | None, info):
        if value is None:
            return value
        numeric_value = float(value)
        if not isfinite(numeric_value):
            raise ValueError(f"{info.field_name} must be finite.")
        if not 0 <= numeric_value <= 1:
            raise ValueError(f"{info.field_name} must be between 0 and 1.")
        return value


def evidence_metadata(payload: dict[str, Any]) -> dict[str, Any]:
    """Describe evidence that was actually present in a validated response."""

    available = [
        field for field in CANONICAL_EVIDENCE_FIELDS if field in payload
    ]
    missing = [
        field for field in CANONICAL_EVIDENCE_FIELDS if field not in payload
    ]
    return {
        "available_evidence": available,
        "missing_evidence": missing,
        "agentic_evidence_status": (
            "complete" if not missing else "incomplete"
        ),
    }