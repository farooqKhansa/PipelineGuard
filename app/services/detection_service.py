"""Detection Core client and explicit live/demo state handling."""
import hashlib
import logging

from app.config import get_settings
from app.services.detection_contract import (
    InvalidDetectionResponse,
    LOCAL_HUGGINGFACE_SOURCE,
    invalid_detection_response,
    unavailable_detection_response,
    validate_detection_response,
)
from app.services.http_client import ExternalServiceError, request_with_retry
from app.services.huggingface_detector import HuggingFaceDetectionError, HuggingFaceDetector

logger = logging.getLogger("pipelineguard.detection")
settings = get_settings()
_local_detector: HuggingFaceDetector | None = None
_local_detector_key: tuple[object, ...] | None = None


def _get_local_detector() -> HuggingFaceDetector:
    global _local_detector, _local_detector_key
    key = (
        settings.DETECTION_MODEL_ID,
        settings.DETECTION_MODEL_INPUT_MODE,
        settings.DETECTION_MODEL_MAX_LENGTH,
        settings.DETECTION_MODEL_PADDING,
        settings.DETECTION_MODEL_TRUNCATION,
        settings.DETECTION_CLEAN_MAX_RISK,
        settings.DETECTION_MALICIOUS_MIN_RISK,
    )
    if _local_detector is None or _local_detector_key != key:
        _local_detector = HuggingFaceDetector(
            model_id=settings.DETECTION_MODEL_ID,
            input_mode=settings.DETECTION_MODEL_INPUT_MODE,
            max_length=settings.DETECTION_MODEL_MAX_LENGTH,
            padding=settings.DETECTION_MODEL_PADDING,
            truncation=settings.DETECTION_MODEL_TRUNCATION,
            clean_max_risk=settings.DETECTION_CLEAN_MAX_RISK,
            malicious_min_risk=settings.DETECTION_MALICIOUS_MIN_RISK,
        )
        _local_detector_key = key
    return _local_detector


def _deterministic_score(seed: str) -> int:
    h = int(hashlib.sha256(seed.encode()).hexdigest(), 16)
    return 20 + (h % 76)  # 20..95, avoids extremes for realism


def mock_detect(repo: str, workflow_run_id: str, diff: str = "") -> dict:
    score = _deterministic_score(f"{repo}:{workflow_run_id}")
    if score >= 80:
        reasons = [
            {"message": "workflow-level permissions widened to write-all", "severity": "critical", "weight": 0.6},
            {"message": "third-party action referenced by mutable tag", "severity": "high", "weight": 0.3},
        ]
    elif score >= 50:
        reasons = [
            {"message": "new secret consumed by a job without an environment gate", "severity": "medium", "weight": 0.5},
        ]
    else:
        reasons = [
            {"message": "dependency version bump with no permission changes", "severity": "low", "weight": 0.2},
        ]
    return {
        "risk_score": score,
        "confidence": round(0.6 + (score % 10) / 100, 2),
        "reasons": reasons,
        "affected_jobs": ["build", "deploy"] if score >= 50 else ["build"],
        "graph_path": ["test", "build", "deploy"] if score >= 50 else ["test", "build"],
        "model_breakdown": {"rules": 0.9, "gbm": round(score / 100, 2), "anomaly": 0.4},
        "repo": repo,
        "workflow_run_id": workflow_run_id,
        "diff": diff,
        "source": "demo",
        "contract_version": "demo",
        "risk_score_scale": "0-100",
        "detection_status": "demo",
        "demo_mode": True,
        "available_evidence": [
            "risk_score",
            "confidence",
            "reasons",
            "affected_jobs",
            "graph_path",
            "model_breakdown",
            "diff",
        ],
        "missing_evidence": [
            "remediation_risk",
            "remediation_unambiguous",
        ],
        "agentic_evidence_status": "incomplete",
    }


async def analyze(
    repo: str,
    workflow_run_id: str,
    diff: str = "",
    *,
    allow_demo_fallback: bool | None = None,
) -> tuple[dict, bool]:
    """
    Returns (payload, used_fallback).

    ``allow_demo_fallback`` is explicit for production callers. When omitted,
    the legacy direct-service behavior follows DEMO_MODE for compatibility;
    the live analyze endpoint and normal webhook flow pass False unless they
    are explicitly running a demo.
    """
    legacy_default = allow_demo_fallback is None
    if legacy_default:
        allow_demo_fallback = settings.DEMO_MODE

    provider = settings.DETECTION_PROVIDER.strip().lower()
    if provider == "local_huggingface":
        try:
            payload = _get_local_detector().detect(diff)
            return (
                validate_detection_response(
                    payload,
                    source=LOCAL_HUGGINGFACE_SOURCE,
                ),
                False,
            )
        except InvalidDetectionResponse as error:
            return (
                invalid_detection_response(
                    repo=repo,
                    workflow_run_id=workflow_run_id,
                    errors=error.errors,
                    source=LOCAL_HUGGINGFACE_SOURCE,
                ),
                False,
            )
        except (HuggingFaceDetectionError, ValueError) as error:
            logger.error(
                "local_detection_unavailable",
                extra={"error": str(error)},
            )
            return (
                unavailable_detection_response(
                    repo=repo,
                    workflow_run_id=workflow_run_id,
                    error=str(error),
                    source=LOCAL_HUGGINGFACE_SOURCE,
                ),
                False,
            )

    if provider != "external":
        return (
            unavailable_detection_response(
                repo=repo,
                workflow_run_id=workflow_run_id,
                error=(
                    "Unsupported DETECTION_PROVIDER. Expected 'external' "
                    "or 'local_huggingface'."
                ),
            ),
            False,
        )

    if not settings.DETECTION_CORE_URL:
        if allow_demo_fallback:
            return mock_detect(repo, workflow_run_id, diff), True
        return (
            unavailable_detection_response(
                repo=repo,
                workflow_run_id=workflow_run_id,
                error="DETECTION_CORE_URL is not configured.",
            ),
            False,
        )

    try:
        resp = await request_with_retry(
            "POST",
            f"{settings.DETECTION_CORE_URL.rstrip('/')}/detect",
            json={"repo": repo, "workflow_run_id": workflow_run_id, "diff": diff},
        )
        try:
            payload = resp.json()
        except ValueError:
            return (
                invalid_detection_response(
                    repo=repo,
                    workflow_run_id=workflow_run_id,
                    errors=[
                        {
                            "loc": [],
                            "message": "response body was not valid JSON",
                            "type": "json_decode_error",
                        }
                    ],
                ),
                False,
            )
        try:
            return validate_detection_response(payload), False
        except InvalidDetectionResponse as error:
            return (
                invalid_detection_response(
                    repo=repo,
                    workflow_run_id=workflow_run_id,
                    errors=error.errors,
                ),
                False,
            )
    except ExternalServiceError as e:
        logger.error("detection_core_unavailable", extra={"error": str(e)})
        if allow_demo_fallback:
            return mock_detect(repo, workflow_run_id, diff), True
        if legacy_default:
            raise
        return (
            unavailable_detection_response(
                repo=repo,
                workflow_run_id=workflow_run_id,
                error=str(e),
            ),
            False,
        )
