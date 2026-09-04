import json
import os
import unittest
from copy import deepcopy
from unittest.mock import patch

from agent.decision import (
    AUTO_FIX,
    DecisionResult,
    ESCALATE_TO_HUMAN,
    PROPOSE_WITH_CAUTION,
    decide,
)
from agent.gemini_advisor import (
    GeminiAdvisor,
    GeminiClientError,
    GeminiRecommendation,
    GeminiResponseError,
    GeminiUnavailableError,
    RELATIONSHIP_CONSISTENT,
    RELATIONSHIP_INVALID,
    RELATIONSHIP_LESS_CONSERVATIVE,
    RELATIONSHIP_MORE_CONSERVATIVE,
    RELATIONSHIP_UNAVAILABLE,
    STATUS_INVALID,
    STATUS_UNAVAILABLE,
    build_prompt,
    enforce_recommendation,
    validate_recommendation,
)
from agent.orchestrator import DEFAULT_WORKFLOW, orchestrate
from audit.logger import create_audit_record
from mocks.load_mock import load_and_validate_mock


def recommendation(action=AUTO_FIX, **overrides):
    value = {
        "recommended_action": action,
        "confidence": 0.96,
        "rationale": "The supplied evidence supports this action.",
        "uncertainty": "No additional uncertainty was identified.",
        "requires_human_review": action != AUTO_FIX,
    }
    value.update(overrides)
    return value


class FakeResponse:
    def __init__(self, text):
        self.text = text


class FakeModels:
    def __init__(self, response=None, error=None):
        self.response = response
        self.error = error
        self.calls = []

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        if self.error is not None:
            raise self.error
        return self.response


class FakeClient:
    def __init__(self, response=None, error=None):
        self.models = FakeModels(response=response, error=error)


class GeminiAdvisorTests(unittest.TestCase):
    def setUp(self):
        self.assessment = load_and_validate_mock()

    def test_valid_auto_fix_recommendation(self):
        advisor = GeminiAdvisor(
            client=FakeClient(
                response=FakeResponse(json.dumps(recommendation(AUTO_FIX)))
            )
        )

        result = advisor.advise(self.assessment)

        self.assertIsInstance(result, GeminiRecommendation)
        self.assertEqual(result.recommended_action, AUTO_FIX)
        self.assertEqual(result.confidence, 0.96)

    def test_valid_propose_with_caution_recommendation(self):
        advisor = GeminiAdvisor(
            client=FakeClient(
                response=FakeResponse(
                    json.dumps(recommendation(PROPOSE_WITH_CAUTION))
                )
            )
        )

        result = advisor.advise(self.assessment)

        self.assertEqual(result.recommended_action, PROPOSE_WITH_CAUTION)
        self.assertTrue(result.requires_human_review)

    def test_valid_escalate_to_human_recommendation(self):
        advisor = GeminiAdvisor(
            client=FakeClient(
                response=FakeResponse(
                    json.dumps(recommendation(ESCALATE_TO_HUMAN))
                )
            )
        )

        result = advisor.advise(self.assessment)

        self.assertEqual(result.recommended_action, ESCALATE_TO_HUMAN)

    def test_gemini_auto_fix_cannot_override_deterministic_escalation(self):
        deterministic = DecisionResult(
            ESCALATE_TO_HUMAN,
            0.40,
            "Confidence is below the safe threshold.",
        )

        result = enforce_recommendation(
            deterministic,
            recommendation(AUTO_FIX),
        )

        self.assertEqual(result.final_enforced_action, ESCALATE_TO_HUMAN)
        self.assertEqual(result.relationship, RELATIONSHIP_LESS_CONSERVATIVE)

    def test_gemini_auto_fix_cannot_override_deterministic_caution(self):
        deterministic = DecisionResult(
            PROPOSE_WITH_CAUTION,
            0.95,
            "The remediation may have significant impact.",
        )

        result = enforce_recommendation(
            deterministic,
            recommendation(AUTO_FIX),
        )

        self.assertEqual(result.final_enforced_action, PROPOSE_WITH_CAUTION)
        self.assertEqual(result.relationship, RELATIONSHIP_LESS_CONSERVATIVE)

    def test_gemini_escalation_makes_auto_fix_more_conservative(self):
        deterministic = DecisionResult(
            AUTO_FIX,
            0.97,
            "The remediation is low risk and unambiguous.",
        )

        result = enforce_recommendation(
            deterministic,
            recommendation(ESCALATE_TO_HUMAN),
        )

        self.assertEqual(result.final_enforced_action, ESCALATE_TO_HUMAN)
        self.assertEqual(result.relationship, RELATIONSHIP_MORE_CONSERVATIVE)

    def test_invalid_action_is_rejected_safely(self):
        with self.assertRaises(GeminiResponseError):
            validate_recommendation(recommendation("DELETE_WORKFLOW"))

    def test_malformed_gemini_response_fails_safely(self):
        advisor = GeminiAdvisor(client=FakeClient(response=FakeResponse("{")))

        with self.assertRaises(GeminiResponseError):
            advisor.advise(self.assessment)

    def test_missing_gemini_response_fails_safely(self):
        advisor = GeminiAdvisor(client=FakeClient(response=FakeResponse(None)))

        with self.assertRaises(GeminiResponseError):
            advisor.advise(self.assessment)

    def test_gemini_client_failure_fails_safely(self):
        advisor = GeminiAdvisor(
            client=FakeClient(error=RuntimeError("provider unavailable"))
        )

        with self.assertRaises(GeminiClientError):
            advisor.advise(self.assessment)

    def test_advisor_without_api_key_does_not_call_network(self):
        with patch.dict(os.environ, {}, clear=True):
            advisor = GeminiAdvisor()

            with self.assertRaises(GeminiUnavailableError):
                advisor.advise(self.assessment)

    def test_api_key_is_not_exposed_in_client_error(self):
        secret = "test-only-gemini-secret"
        advisor = GeminiAdvisor(
            api_key=secret,
            client=FakeClient(error=RuntimeError(secret)),
        )

        with self.assertRaises(GeminiClientError) as raised:
            advisor.advise(self.assessment)

        self.assertNotIn(secret, str(raised.exception))

    def test_prompt_contains_relevant_structured_fields_only(self):
        assessment = deepcopy(self.assessment)
        assessment["unrelated_secret"] = "must-not-be-sent"
        prompt = build_prompt(
            assessment,
            workflow_context={"jobs": ["test", "deploy"]},
        )

        self.assertIn("detected_issue", prompt)
        self.assertIn("risk_score", prompt)
        self.assertIn("remediation_risk", prompt)
        self.assertIn("workflow_context", prompt)
        self.assertIn("short observable rationale", prompt)
        self.assertNotIn("must-not-be-sent", prompt)

    def test_existing_deterministic_decision_behavior_is_unchanged(self):
        result = decide(self.assessment)

        self.assertEqual(result.action, AUTO_FIX)
        self.assertEqual(result.confidence, 0.97)

    def test_recommendation_and_final_action_are_distinguishable(self):
        deterministic = DecisionResult(
            AUTO_FIX,
            0.97,
            "The remediation is low risk and unambiguous.",
        )
        boundary = enforce_recommendation(
            deterministic,
            recommendation(ESCALATE_TO_HUMAN),
        )
        data = boundary.to_dict()

        self.assertEqual(
            data["gemini_recommendation"]["recommended_action"],
            ESCALATE_TO_HUMAN,
        )
        self.assertEqual(data["deterministic_action"], AUTO_FIX)
        self.assertEqual(data["final_enforced_action"], ESCALATE_TO_HUMAN)

    def test_human_review_flag_prevents_gemini_auto_fix_enforcement(self):
        deterministic = DecisionResult(
            AUTO_FIX,
            0.97,
            "The remediation is low risk and unambiguous.",
        )

        boundary = enforce_recommendation(
            deterministic,
            recommendation(AUTO_FIX, requires_human_review=True),
        )

        self.assertEqual(boundary.final_enforced_action, PROPOSE_WITH_CAUTION)
        self.assertEqual(boundary.relationship, RELATIONSHIP_CONSISTENT)

    def test_invalid_recommendation_boundary_preserves_deterministic_action(self):
        deterministic = DecisionResult(
            AUTO_FIX,
            0.97,
            "The remediation is low risk and unambiguous.",
        )

        boundary = enforce_recommendation(
            deterministic,
            {"recommended_action": "invalid"},
        )

        self.assertEqual(boundary.final_enforced_action, AUTO_FIX)
        self.assertEqual(boundary.status, STATUS_INVALID)
        self.assertEqual(boundary.relationship, RELATIONSHIP_INVALID)

    def test_unavailable_boundary_preserves_deterministic_action(self):
        deterministic = DecisionResult(
            AUTO_FIX,
            0.97,
            "The remediation is low risk and unambiguous.",
        )

        boundary = enforce_recommendation(
            deterministic,
            status=STATUS_UNAVAILABLE,
        )

        self.assertEqual(boundary.final_enforced_action, AUTO_FIX)
        self.assertEqual(boundary.relationship, RELATIONSHIP_UNAVAILABLE)

    def test_audit_can_record_gemini_boundary_metadata(self):
        deterministic = DecisionResult(
            AUTO_FIX,
            0.97,
            "The remediation is low risk and unambiguous.",
        )
        boundary = enforce_recommendation(
            deterministic,
            recommendation(ESCALATE_TO_HUMAN),
        )
        audit = create_audit_record(
            assessment=self.assessment,
            decision=deterministic,
            gemini=boundary,
            audit_id="audit-gemini-001",
            timestamp="2026-08-31T17:00:00+00:00",
        )

        data = audit.to_dict()

        self.assertEqual(data["deterministic_action"], AUTO_FIX)
        self.assertEqual(
            data["gemini_recommended_action"],
            ESCALATE_TO_HUMAN,
        )
        self.assertEqual(data["final_enforced_action"], ESCALATE_TO_HUMAN)
        self.assertEqual(data["gemini_relationship"], RELATIONSHIP_MORE_CONSERVATIVE)

    def test_orchestrator_preserves_deterministic_flow_when_gemini_unavailable(self):
        result = orchestrate(
            self.assessment,
            DEFAULT_WORKFLOW,
            gemini_advisor=GeminiAdvisor(),
        )

        self.assertEqual(result.deterministic_action, AUTO_FIX)
        self.assertEqual(result.action, AUTO_FIX)
        self.assertIsNotNone(result.fix)
        self.assertEqual(result.gemini.status, STATUS_UNAVAILABLE)
        self.assertEqual(result.gemini.relationship, RELATIONSHIP_UNAVAILABLE)
        self.assertTrue(result.warnings)

    def test_orchestrator_blocks_fix_when_gemini_recommends_escalation(self):
        advisor = GeminiAdvisor(
            client=FakeClient(
                response=FakeResponse(
                    json.dumps(recommendation(ESCALATE_TO_HUMAN))
                )
            )
        )

        result = orchestrate(
            self.assessment,
            DEFAULT_WORKFLOW,
            gemini_advisor=advisor,
        )

        self.assertEqual(result.deterministic_action, AUTO_FIX)
        self.assertEqual(result.action, ESCALATE_TO_HUMAN)
        self.assertIsNone(result.fix)
        self.assertIsNone(result.verification)
        self.assertEqual(
            result.audit.final_enforced_action,
            ESCALATE_TO_HUMAN,
        )

    def test_orchestrator_blocks_auto_fix_when_gemini_recommends_caution(self):
        advisor = GeminiAdvisor(
            client=FakeClient(
                response=FakeResponse(
                    json.dumps(recommendation(PROPOSE_WITH_CAUTION))
                )
            )
        )

        result = orchestrate(
            self.assessment,
            DEFAULT_WORKFLOW,
            gemini_advisor=advisor,
        )

        self.assertEqual(result.action, PROPOSE_WITH_CAUTION)
        self.assertIsNone(result.fix)
        self.assertIsNone(result.verification)
        self.assertTrue(result.human_review_required)


if __name__ == "__main__":
    unittest.main()