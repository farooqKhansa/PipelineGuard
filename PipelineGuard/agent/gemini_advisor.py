"""Optional Gemini structured advisor behind the deterministic safety boundary."""

from dataclasses import dataclass
import json
import math
import os
from typing import Any, Mapping

from agent.decision import (
    AUTO_FIX,
    ESCALATE_TO_HUMAN,
    PROPOSE_WITH_CAUTION,
)


GEMINI_API_KEY_ENV = "GEMINI_API_KEY"
GEMINI_MODEL_ENV = "GEMINI_MODEL"
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
ALLOWED_ACTIONS = frozenset(
    {AUTO_FIX, PROPOSE_WITH_CAUTION, ESCALATE_TO_HUMAN}
)

STATUS_AVAILABLE = "available"
STATUS_INVALID = "invalid"
STATUS_UNAVAILABLE = "unavailable"
STATUS_NOT_CONFIGURED = "not_configured"

RELATIONSHIP_CONSISTENT = "consistent"
RELATIONSHIP_MORE_CONSERVATIVE = "more_conservative"
RELATIONSHIP_LESS_CONSERVATIVE = "less_conservative"
RELATIONSHIP_INVALID = "invalid"
RELATIONSHIP_UNAVAILABLE = "unavailable"

RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "recommended_action": {
            "type": "STRING",
            "enum": [AUTO_FIX, PROPOSE_WITH_CAUTION, ESCALATE_TO_HUMAN],
        },
        "confidence": {"type": "NUMBER"},
        "rationale": {"type": "STRING"},
        "uncertainty": {"type": "STRING"},
        "requires_human_review": {"type": "BOOLEAN"},
    },
    "required": [
        "recommended_action",
        "confidence",
        "rationale",
        "uncertainty",
        "requires_human_review",
    ],
}

_ACTION_RANK = {
    AUTO_FIX: 0,
    PROPOSE_WITH_CAUTION: 1,
    ESCALATE_TO_HUMAN: 2,
}


class GeminiAdvisorError(RuntimeError):
    """Base error for unavailable or unusable Gemini advisor results."""


class GeminiUnavailableError(GeminiAdvisorError):
    """Raised when Gemini cannot be used in the current environment."""


class GeminiResponseError(GeminiAdvisorError):
    """Raised when Gemini returns invalid structured output."""


class GeminiClientError(GeminiAdvisorError):
    """Raised when the Gemini client request fails."""


@dataclass(frozen=True)
class GeminiRecommendation:
    """The validated, concise recommendation returned by Gemini."""

    recommended_action: str
    confidence: float
    rationale: str
    uncertainty: str
    requires_human_review: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "recommended_action": self.recommended_action,
            "confidence": self.confidence,
            "rationale": self.rationale,
            "uncertainty": self.uncertainty,
            "requires_human_review": self.requires_human_review,
        }


@dataclass(frozen=True)
class GeminiBoundaryResult:
    """Comparison between Gemini advice and the enforced deterministic action."""

    deterministic_action: str | None
    recommendation: GeminiRecommendation | None
    final_enforced_action: str | None
    relationship: str
    status: str
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        result = {
            "deterministic_action": self.deterministic_action,
            "gemini_recommendation": (
                self.recommendation.to_dict()
                if self.recommendation is not None
                else None
            ),
            "final_enforced_action": self.final_enforced_action,
            "relationship": self.relationship,
            "status": self.status,
        }
        if self.error is not None:
            result["error"] = self.error
        return result


def _get(value: Any, key: str, default: Any = None) -> Any:
    if isinstance(value, Mapping):
        return value.get(key, default)
    return getattr(value, key, default)


def _action_of(value: Any) -> str | None:
    action = _get(value, "action")
    return str(action) if action is not None else None


def _assessment_payload(
    assessment: Mapping[str, Any],
    workflow_context: Any = None,
) -> dict[str, Any]:
    reasons = assessment.get("reasons")
    payload: dict[str, Any] = {}
    issue = (
        assessment.get("description")
        or assessment.get("title")
        or (reasons[0] if isinstance(reasons, list) and reasons else None)
    )
    values = (
        ("detected_issue", issue),
        ("confidence", assessment.get("confidence")),
        ("risk_score", assessment.get("risk_score")),
        ("remediation_risk", assessment.get("remediation_risk")),
        ("remediation_unambiguous", assessment.get("remediation_unambiguous")),
        ("affected_jobs", assessment.get("affected_jobs")),
        ("evidence", reasons),
        ("assessment_diff", assessment.get("diff")),
    )
    for name, value in values:
        if value is not None:
            payload[name] = value
    if workflow_context is not None:
        payload["workflow_context"] = workflow_context
    return payload


def build_prompt(
    assessment: Mapping[str, Any],
    workflow_context: Any = None,
) -> str:
    """Build the constrained prompt sent to the structured Gemini request."""

    if not isinstance(assessment, Mapping):
        raise ValueError("The assessment must be a structured mapping.")

    instructions = (
        "You are a security-pipeline decision advisor. Analyze only the supplied "
        "structured assessment and workflow context. Do not invent missing "
        "information or assume intent without evidence. Prefer "
        "ESCALATE_TO_HUMAN when uncertainty is significant. AUTO_FIX is "
        "appropriate only for high-confidence, low-risk, unambiguous remediation. "
        "High-impact changes require PROPOSE_WITH_CAUTION and human review. "
        "Return only the requested concise JSON fields and a short observable "
        "rationale; do not provide private internal reasoning."
    )
    return (
        instructions
        + "\n\nAssessment input:\n"
        + json.dumps(
            _assessment_payload(assessment, workflow_context),
            indent=2,
            ensure_ascii=False,
        )
    )


def validate_recommendation(value: Any) -> GeminiRecommendation:
    """Validate a decoded Gemini response against the strict result contract."""

    if isinstance(value, GeminiRecommendation):
        return value
    if not isinstance(value, Mapping):
        raise GeminiResponseError(
            "Gemini response must be a structured object."
        )

    required = (
        "recommended_action",
        "confidence",
        "rationale",
        "uncertainty",
        "requires_human_review",
    )
    missing = [field for field in required if field not in value]
    if missing:
        raise GeminiResponseError(
            "Gemini response is missing required structured fields."
        )

    action = value["recommended_action"]
    confidence = value["confidence"]
    rationale = value["rationale"]
    uncertainty = value["uncertainty"]
    requires_human_review = value["requires_human_review"]

    if not isinstance(action, str) or action not in ALLOWED_ACTIONS:
        raise GeminiResponseError("Gemini returned an unsupported action.")
    if (
        not isinstance(confidence, (int, float))
        or isinstance(confidence, bool)
        or not math.isfinite(confidence)
        or not 0.0 <= confidence <= 1.0
    ):
        raise GeminiResponseError("Gemini returned an invalid confidence.")
    if not isinstance(rationale, str) or not rationale.strip():
        raise GeminiResponseError("Gemini returned an invalid rationale.")
    if not isinstance(uncertainty, str) or not uncertainty.strip():
        raise GeminiResponseError("Gemini returned invalid uncertainty.")
    if not isinstance(requires_human_review, bool):
        raise GeminiResponseError(
            "Gemini returned an invalid human-review flag."
        )

    return GeminiRecommendation(
        recommended_action=action,
        confidence=float(confidence),
        rationale=rationale.strip(),
        uncertainty=uncertainty.strip(),
        requires_human_review=requires_human_review,
    )


def _decode_response(response: Any) -> GeminiRecommendation:
    if isinstance(response, GeminiRecommendation):
        return response
    raw = getattr(response, "text", response)
    if raw is None:
        raw = getattr(response, "parsed", None)
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError as error:
            raise GeminiResponseError(
                "Gemini response was not valid JSON."
            ) from error
    return validate_recommendation(raw)


class GeminiAdvisor:
    """A lazy, injectable Gemini client for structured recommendations."""

    def __init__(
        self,
        *,
        client: Any = None,
        api_key: str | None = None,
        model: str | None = None,
    ):
        self._client = client
        self._api_key = api_key
        self.model = model or os.getenv(GEMINI_MODEL_ENV, DEFAULT_GEMINI_MODEL)

    def _client_or_create(self) -> Any:
        if self._client is not None:
            return self._client

        api_key = self._api_key or os.getenv(GEMINI_API_KEY_ENV)
        if not api_key:
            raise GeminiUnavailableError(
                f"Gemini is not configured; set {GEMINI_API_KEY_ENV}."
            )
        try:
            from google import genai
        except ImportError as error:
            raise GeminiUnavailableError(
                "The official google-genai SDK is not installed."
            ) from error

        self._client = genai.Client(api_key=api_key)
        return self._client

    def advise(
        self,
        assessment: Mapping[str, Any],
        workflow_context: Any = None,
    ) -> GeminiRecommendation:
        """Request and validate one structured recommendation."""

        prompt = build_prompt(assessment, workflow_context)
        client = self._client_or_create()
        try:
            from google.genai import types

            response = client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=RESPONSE_SCHEMA,
                ),
            )
        except GeminiAdvisorError:
            raise
        except Exception as error:
            raise GeminiClientError("Gemini request failed.") from error
        return _decode_response(response)


def _fallback(
    deterministic_action: str | None,
    *,
    status: str,
    relationship: str,
    error: str | None = None,
) -> GeminiBoundaryResult:
    return GeminiBoundaryResult(
        deterministic_action=deterministic_action,
        recommendation=None,
        final_enforced_action=deterministic_action,
        relationship=relationship,
        status=status,
        error=error,
    )


def enforce_recommendation(
    deterministic_decision: Any,
    recommendation: Any = None,
    *,
    status: str = STATUS_AVAILABLE,
    error: str | None = None,
) -> GeminiBoundaryResult:
    """Apply the conservative boundary without changing deterministic policy."""

    deterministic_action = _action_of(deterministic_decision)
    if deterministic_action not in _ACTION_RANK:
        return _fallback(
            ESCALATE_TO_HUMAN,
            status=STATUS_INVALID,
            relationship=RELATIONSHIP_INVALID,
            error="The deterministic action was invalid.",
        )

    if status != STATUS_AVAILABLE:
        relationship = (
            RELATIONSHIP_INVALID
            if status == STATUS_INVALID
            else RELATIONSHIP_UNAVAILABLE
        )
        return _fallback(
            deterministic_action,
            status=status,
            relationship=relationship,
            error=error,
        )

    try:
        validated = validate_recommendation(recommendation)
    except GeminiAdvisorError:
        return _fallback(
            deterministic_action,
            status=STATUS_INVALID,
            relationship=RELATIONSHIP_INVALID,
            error="The Gemini recommendation was invalid.",
        )

    recommended_action = validated.recommended_action
    if _ACTION_RANK[recommended_action] == _ACTION_RANK[deterministic_action]:
        relationship = RELATIONSHIP_CONSISTENT
    elif _ACTION_RANK[recommended_action] > _ACTION_RANK[deterministic_action]:
        relationship = RELATIONSHIP_MORE_CONSERVATIVE
    else:
        relationship = RELATIONSHIP_LESS_CONSERVATIVE

    final_action = recommended_action
    if validated.requires_human_review and final_action == AUTO_FIX:
        final_action = PROPOSE_WITH_CAUTION
    if _ACTION_RANK[deterministic_action] >= _ACTION_RANK[final_action]:
        final_action = deterministic_action

    return GeminiBoundaryResult(
        deterministic_action=deterministic_action,
        recommendation=validated,
        final_enforced_action=final_action,
        relationship=relationship,
        status=STATUS_AVAILABLE,
    )


def unavailable_boundary(
    deterministic_decision: Any,
    *,
    configured: bool = False,
) -> GeminiBoundaryResult:
    """Represent an optional advisor that was not available."""

    action = _action_of(deterministic_decision)
    return _fallback(
        action,
        status=STATUS_NOT_CONFIGURED if not configured else STATUS_UNAVAILABLE,
        relationship=RELATIONSHIP_UNAVAILABLE,
    )