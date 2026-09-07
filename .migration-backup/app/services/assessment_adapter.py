"""Conservative structural adapter for detection results.

This adapter performs no policy decisions. It only converts explicitly
declared score scales and extracts observable reason text. Missing fields and
unconfirmed model semantics are preserved for the authoritative policy to
handle.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any


def adapt_detection_assessment(
    detection_result: Mapping[str, Any],
    *,
    repo: str,
    workflow_run_id: str,
    risk_score_scale: str = "unknown",
) -> dict[str, Any]:
    """Return an assessment in the agentic layer's structural format."""

    if not isinstance(detection_result, Mapping):
        return {}

    assessment = dict(detection_result)
    assessment.setdefault("repo", repo)
    assessment.setdefault("workflow_run_id", workflow_run_id)

    if risk_score_scale == "0-100":
        score = assessment.get("risk_score")
        if isinstance(score, (int, float)) and not isinstance(score, bool):
            assessment["risk_score"] = score / 100
    elif risk_score_scale not in {"0-1", "unknown"}:
        raise ValueError(
            "risk_score_scale must be one of: 0-1, 0-100, unknown."
        )

    reasons = assessment.get("reasons")
    if isinstance(reasons, list):
        observable_reasons: list[Any] = []
        for reason in reasons:
            if isinstance(reason, Mapping):
                message = reason.get("message")
                if isinstance(message, str) and message.strip():
                    observable_reasons.append(message.strip())
            elif isinstance(reason, str) and reason.strip():
                observable_reasons.append(reason.strip())
        assessment["reasons"] = observable_reasons

    return assessment


def dashboard_risk_score(
    assessment: Mapping[str, Any],
    *,
    source_scale: str,
) -> int:
    """Convert a known agentic score into the dashboard's 0–100 display scale."""

    score = assessment.get("risk_score")
    if not isinstance(score, (int, float)) or isinstance(score, bool):
        return 0
    if source_scale == "0-100":
        return round(score)
    if source_scale == "0-1":
        return round(score * 100)
    # Unknown scales are not interpreted; invalid/out-of-range values remain
    # conservative rather than being silently re-scaled.
    return round(score) if score > 1 else 0