"""
Agentic Layer client. Configurable via AGENTIC_LAYER_URL.

Same fallback contract as the Detection Core client: real call first, then a
deterministic mock under DEMO_MODE if the real service is unavailable.
"""
import logging

from app.config import get_settings
from app.services.http_client import ExternalServiceError, request_with_retry

logger = logging.getLogger("pipelineguard.agentic")
settings = get_settings()


def mock_decide(risk: dict) -> dict:
    score = risk.get("risk_score", 50)
    confidence = risk.get("confidence", 0.5)
    if isinstance(confidence, (int, float)) and confidence > 1:
        confidence = confidence / 100

    if score < 40:
        action = "auto_fix"
        conf = max(confidence, 0.9)
        fix_diff = (
            "--- a/.github/workflows/ci.yml\n+++ b/.github/workflows/ci.yml\n"
            "@@ -10,7 +10,7 @@\n-    timeout-minutes: 0\n+    timeout-minutes: 15\n"
        )
        explanation_en = "Low-risk configuration drift. Applied a safe, verified fix automatically."
        explanation_ur = "کم خطرہ کنفیگریشن تبدیلی۔ ایک محفوظ، تصدیق شدہ حل خودکار طور پر لاگو کیا گیا۔"
        return {
            "action": action,
            "confidence": conf,
            "fix_diff": fix_diff,
            "verification": {"passed": True, "method": "dry-run replay against last 5 runs", "tests_run": 5, "tests_passed": 5},
            "explanation_en": explanation_en,
            "explanation_ur": explanation_ur,
            "escalation_reason": None,
            "pr_url": None,
        }
    elif score < 75:
        action = "propose_with_caution"
        return {
            "action": action,
            "confidence": max(confidence, 0.6),
            "fix_diff": (
                "--- a/.github/workflows/deploy.yml\n+++ b/.github/workflows/deploy.yml\n"
                "@@ -5,6 +5,7 @@\n permissions:\n   contents: read\n+  id-token: write\n-  actions: write\n"
            ),
            "verification": {"passed": False, "method": "static diff review only; no live re-run performed"},
            "explanation_en": "Medium-confidence finding. A fix is proposed but requires human review before merge.",
            "explanation_ur": "درمیانی اعتماد کی دریافت۔ ایک حل تجویز کیا گیا ہے لیکن ضم کرنے سے پہلے انسانی جائزے کی ضرورت ہے۔",
            "escalation_reason": None,
            "pr_url": None,
        }
    else:
        return {
            "action": "escalate",
            "confidence": min(confidence, 0.5),
            "fix_diff": None,
            "verification": None,
            "explanation_en": "High risk with competing explanations for the change. Escalated instead of guessing.",
            "explanation_ur": "زیادہ خطرہ اور تبدیلی کی متضاد وضاحتیں۔ اندازہ لگانے کے بجائے انسانی جائزے کے لیے بھیجا گیا۔",
            "escalation_reason": "risk_score and permission-widening pattern both present, but intent could not be confirmed against workflow history",
            "pr_url": None,
        }


async def decide(risk: dict) -> tuple[dict, bool]:
    """
    Returns (payload, used_fallback).
    """
    if not settings.AGENTIC_LAYER_URL:
        return mock_decide(risk), True

    try:
        resp = await request_with_retry(
            "POST",
            f"{settings.AGENTIC_LAYER_URL.rstrip('/')}/decide",
            json={"risk": risk},
        )
        return resp.json(), False
    except ExternalServiceError as e:
        logger.error("agentic_layer_unavailable", extra={"error": str(e)})
        if settings.DEMO_MODE:
            return mock_decide(risk), True
        raise
