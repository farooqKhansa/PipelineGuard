"""Schemas for factual, observable PipelineGuard audit records."""

from dataclasses import dataclass
import json
from typing import Any


@dataclass(frozen=True)
class AuditCheck:
    """One verification check as reported by the verifier."""

    name: str
    status: str
    message: str | None = None

    def to_dict(self) -> dict[str, str]:
        result = {
            "name": self.name,
            "status": self.status,
        }
        if self.message:
            result["message"] = self.message
        return result


@dataclass(frozen=True)
class AuditRecord:
    """A serializable record of supplied decisions and system outputs."""

    audit_id: str
    timestamp: str
    repository: str | None = None
    workflow_run_id: str | None = None
    issue_id: str | None = None
    risk_score: float | int | None = None
    confidence: float | int | None = None
    selected_action: str | None = None
    remediation_risk: str | None = None
    remediation_unambiguous: bool | None = None
    fix_generated: bool = False
    fix_diff: str | None = None
    verification_status: str = "unknown"
    verification_checks: tuple[AuditCheck, ...] = ()
    english_explanation: str | None = None
    roman_urdu_explanation: str | None = None
    reasoning: tuple[str, ...] = ()
    review_items: tuple[str, ...] = ()
    deterministic_action: str | None = None
    gemini_recommended_action: str | None = None
    gemini_confidence: float | int | None = None
    gemini_rationale: str | None = None
    gemini_uncertainty: str | None = None
    gemini_requires_human_review: bool | None = None
    gemini_relationship: str | None = None
    gemini_status: str | None = None
    final_enforced_action: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Serialize only supplied or explicitly observed information."""

        result: dict[str, Any] = {
            "audit_id": self.audit_id,
            "timestamp": self.timestamp,
            "fix_generated": self.fix_generated,
            "verification_status": self.verification_status,
            "verification_checks": [
                check.to_dict() for check in self.verification_checks
            ],
        }
        optional_values = (
            ("repository", self.repository),
            ("workflow_run_id", self.workflow_run_id),
            ("issue_id", self.issue_id),
            ("risk_score", self.risk_score),
            ("confidence", self.confidence),
            ("selected_action", self.selected_action),
            ("remediation_risk", self.remediation_risk),
            ("remediation_unambiguous", self.remediation_unambiguous),
            ("fix_diff", self.fix_diff if self.fix_generated else None),
            ("english_explanation", self.english_explanation),
            ("roman_urdu_explanation", self.roman_urdu_explanation),
            ("deterministic_action", self.deterministic_action),
            ("gemini_recommended_action", self.gemini_recommended_action),
            ("gemini_confidence", self.gemini_confidence),
            ("gemini_rationale", self.gemini_rationale),
            ("gemini_uncertainty", self.gemini_uncertainty),
            ("gemini_requires_human_review", self.gemini_requires_human_review),
            ("gemini_relationship", self.gemini_relationship),
            ("gemini_status", self.gemini_status),
            ("final_enforced_action", self.final_enforced_action),
        )
        for name, value in optional_values:
            if value is not None:
                result[name] = value

        if self.reasoning:
            result["reasoning"] = list(self.reasoning)
        if self.review_items:
            result["review_items"] = list(self.review_items)
        return result

    def to_json(self, *, indent: int = 2) -> str:
        """Serialize the record as valid JSON."""

        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)