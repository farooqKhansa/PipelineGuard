"""Validation and observability helpers for Detection Core responses."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from pydantic import ValidationError

from app.schemas.detection import (
    CANONICAL_EVIDENCE_FIELDS,
    DetectionCoreResponse,
    evidence_metadata,
)

CONTRACT_VERSION = "v1"
EXTERNAL_SOURCE = "external_detection_core"
LOCAL_HUGGINGFACE_SOURCE = "local_huggingface"
EXTERNAL_RISK_SCORE_SCALE = "0-1"


class InvalidDetectionResponse(ValueError):
    """Raised when Detection Core returns a structurally invalid payload."""

    def __init__(self, errors: list[dict[str, Any]]):
        self.errors = errors
        super().__init__("Detection Core returned an invalid response.")


def _validation_errors(error: ValidationError) -> list[dict[str, Any]]:
    return [
        {
            "loc": [str(part) for part in item.get("loc", ())],
            "message": item.get("msg", "invalid value"),
            "type": item.get("type", "validation_error"),
        }
        for item in error.errors()
    ]


def validate_detection_response(
    payload: Any,
    *,
    source: str = EXTERNAL_SOURCE,
) -> dict[str, Any]:
    """Validate and return a JSON-safe Detection Core response.

    Required fields are ``status`` and ``risk_score``. Optional canonical
    evidence is retained only when supplied by Detection Core. Unknown fields
    are preserved for forward compatibility but are not counted as canonical
    evidence.
    """

    if not isinstance(payload, Mapping):
        raise InvalidDetectionResponse(
            [
                {
                    "loc": [],
                    "message": "response must be a JSON object",
                    "type": "response_type",
                }
            ]
        )

    try:
        model = DetectionCoreResponse.model_validate(dict(payload))
    except ValidationError as error:
        raise InvalidDetectionResponse(_validation_errors(error)) from error

    normalized = model.model_dump(exclude_none=True)
    normalized.update(
        {
            "source": source,
            "contract_version": CONTRACT_VERSION,
            "risk_score_scale": EXTERNAL_RISK_SCORE_SCALE,
            "detection_status": (
                "complete"
                if all(field in normalized for field in CANONICAL_EVIDENCE_FIELDS[1:])
                else "complete_for_detection"
            ),
        }
    )
    normalized.update(evidence_metadata(normalized))
    return normalized


def unavailable_detection_response(
    *,
    repo: str,
    workflow_run_id: str,
    error: str,
    source: str = EXTERNAL_SOURCE,
) -> dict[str, Any]:
    """Return an explicit no-result state without a synthetic score."""

    return {
        "source": source,
        "contract_version": CONTRACT_VERSION,
        "risk_score_scale": EXTERNAL_RISK_SCORE_SCALE,
        "detection_status": "unavailable",
        "agentic_evidence_status": "incomplete",
        "available_evidence": [],
        "missing_evidence": list(CANONICAL_EVIDENCE_FIELDS),
        "validation_errors": [],
        "error": error,
        "repo": repo,
        "workflow_run_id": workflow_run_id,
    }


def invalid_detection_response(
    *,
    repo: str,
    workflow_run_id: str,
    errors: list[dict[str, Any]],
    source: str = EXTERNAL_SOURCE,
) -> dict[str, Any]:
    """Return an explicit validation failure without retaining invalid data."""

    return {
        "source": source,
        "contract_version": CONTRACT_VERSION,
        "risk_score_scale": EXTERNAL_RISK_SCORE_SCALE,
        "detection_status": "invalid_response",
        "agentic_evidence_status": "incomplete",
        "available_evidence": [],
        "missing_evidence": list(CANONICAL_EVIDENCE_FIELDS),
        "validation_errors": errors,
        "repo": repo,
        "workflow_run_id": workflow_run_id,
    }