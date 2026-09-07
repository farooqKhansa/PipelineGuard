"""Thin adapter around the authoritative Workstream 2 agentic layer.

This module deliberately owns transport concerns only. Policy selection,
controlled fix generation, verification, explanations, audit construction,
and Gemini enforcement remain in ``agent.orchestrator``.
"""

from __future__ import annotations

import os
from pathlib import Path
import sys
from typing import Any, Mapping

from app.config import get_settings


class AgenticBoundaryError(RuntimeError):
    """Base error for an unavailable or invalid boundary request."""


class AgenticLayerUnavailable(AgenticBoundaryError):
    """Raised when the authoritative package cannot be imported."""


class InvalidAgenticRequest(ValueError):
    """Raised when the endpoint request is not structurally usable."""


def _load_orchestrate():
    """Load the existing orchestrator without copying its implementation.

    The package is intentionally resolved at call time. This keeps the
    dashboard importable while deployments configure the authoritative package
    location through ``AGENTIC_LAYER_PATH``.
    """

    try:
        from agent.orchestrator import orchestrate

        return orchestrate
    except ModuleNotFoundError as first_error:
        configured_path = (
            os.getenv("AGENTIC_LAYER_PATH")
            or get_settings().AGENTIC_LAYER_PATH
        ).strip()
        if not configured_path:
            raise AgenticLayerUnavailable(
                "The authoritative agentic package is not importable. "
                "Configure AGENTIC_LAYER_PATH to the directory containing "
                "the agent/ and audit/ packages."
            ) from first_error

        package_root = Path(configured_path).expanduser()
        if not package_root.is_dir():
            raise AgenticLayerUnavailable(
                f"Configured AGENTIC_LAYER_PATH does not exist: {package_root}"
            ) from first_error

        package_root_string = str(package_root.resolve())
        if package_root_string not in sys.path:
            sys.path.insert(0, package_root_string)

        try:
            from agent.orchestrator import orchestrate
        except ModuleNotFoundError as import_error:
            raise AgenticLayerUnavailable(
                "The authoritative agentic package could not be imported from "
                f"{package_root}: {import_error}"
            ) from import_error

        return orchestrate


def _validate_request(
    assessment: Mapping[str, Any],
    workflow_content: str,
) -> None:
    """Validate only the boundary's structural preconditions.

    Deliberately do not validate policy fields here. Missing assessment data
    must reach the authoritative decision engine so it can produce its real
    conservative escalation and reason.
    """

    if not isinstance(assessment, Mapping):
        raise InvalidAgenticRequest("assessment must be a structured object.")
    if not isinstance(workflow_content, str) or not workflow_content.strip():
        raise InvalidAgenticRequest(
            "workflow_content must contain the complete workflow text."
        )


def _value_from(value: Any, key: str, default: Any = None) -> Any:
    if isinstance(value, Mapping):
        return value.get(key, default)
    return getattr(value, key, default)


def _adapt_for_backend(result: Any, serialized: dict[str, Any]) -> dict[str, Any]:
    """Expose a flat, frontend-oriented view without inventing data."""

    decision = serialized.get("decision") or {}
    fix = serialized.get("fix")
    verification = serialized.get("verification")
    explanation = serialized.get("explanation") or {}

    return {
        "action": result.action,
        "deterministic_action": result.deterministic_action,
        "confidence": _value_from(decision, "confidence"),
        "decision_reason": _value_from(decision, "reason"),
        "fix_diff": _value_from(fix, "unified_diff"),
        "verification": verification,
        "explanation_en": _value_from(explanation, "english"),
        "explanation_ur": _value_from(explanation, "roman_urdu"),
        "reasoning": _value_from(explanation, "reasoning"),
        "review_items": _value_from(explanation, "review_items"),
        "audit": serialized.get("audit"),
        "human_review_required": serialized.get("human_review_required"),
        "warnings": serialized.get("warnings"),
        "error": serialized.get("error"),
        # The current agentic layer does not create GitHub PRs. Keeping this
        # explicitly null makes that absence visible without claiming a PR.
        "pr_url": None,
    }


def run_agentic_boundary(
    assessment: Mapping[str, Any],
    workflow_content: str,
) -> dict[str, Any]:
    """Run the authoritative orchestrator and serialize its observable result."""

    _validate_request(assessment, workflow_content)
    orchestrate = _load_orchestrate()
    result = orchestrate(
        assessment,
        workflow_content,
        gemini_advisor=None,
        audit_directory=None,
    )

    serialized = result.to_dict()
    # ``OrchestrationResult.to_dict`` intentionally serializes fields, while
    # action properties are computed properties. Preserve both explicitly.
    serialized["action"] = result.action
    serialized["deterministic_action"] = result.deterministic_action

    return {
        "agentic_result": serialized,
        "agent": _adapt_for_backend(result, serialized),
    }


def unavailable_agentic_result(
    reason: str,
    assessment: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Return an explicit conservative state when integration cannot run."""

    serialized = {
        "assessment": dict(assessment) if isinstance(assessment, Mapping) else assessment,
        "decision": None,
        "fix": None,
        "verification": None,
        "explanation": None,
        "audit": None,
        "gemini": None,
        "human_review_required": True,
        "error": reason,
        "action": None,
        "deterministic_action": None,
    }
    return {
        "agentic_result": serialized,
        "agent": {
            "action": None,
            "deterministic_action": None,
            "confidence": None,
            "decision_reason": None,
            "fix_diff": None,
            "verification": None,
            "explanation_en": None,
            "explanation_ur": None,
            "reasoning": None,
            "review_items": None,
            "audit": None,
            "human_review_required": True,
            "warnings": None,
            "error": reason,
            "pr_url": None,
        },
    }


# The name used by the dashboard integration milestone. Keep the original
# implementation name as a readable alias for callers that already use it.
run_agentic_decision = run_agentic_boundary