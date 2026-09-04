import json
from pathlib import Path
import unittest

from agent.decision import (
    AUTO_FIX,
    ESCALATE_TO_HUMAN,
    PROPOSE_WITH_CAUTION,
    DecisionResult,
    decide,
)
from agent.explanations import ExplanationResult, explain
from agent.fix_generator import generate_fix
from agent.verifier import (
    CheckResult,
    VerificationResult,
    FAILED,
    PASSED,
    PASSED_WITH_SKIPS,
    SKIPPED,
)


MOCK_PATH = (
    Path(__file__).resolve().parents[1] / "mocks" / "risk_assessment_auto_fix.json"
)

ORIGINAL_WORKFLOW = """name: CI

on:
  push:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./scripts/test.sh

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        run: ./scripts/deploy.sh
"""


def load_assessment():
    with MOCK_PATH.open(encoding="utf-8") as mock_file:
        return json.load(mock_file)


def current_results():
    assessment = load_assessment()
    decision = decide(assessment)
    fix = generate_fix(ORIGINAL_WORKFLOW, assessment)
    verification = VerificationResult(
        status=PASSED,
        checks=(
            CheckResult("YAML parsing", PASSED, "Generated workflow parsed."),
            CheckResult("yamllint", PASSED, "yamllint completed."),
            CheckResult("Change scope", PASSED, "The security-tests job was restored."),
        ),
    )
    return assessment, decision, fix, verification


class ExplanationTests(unittest.TestCase):
    def test_auto_fix_english_explanation(self):
        assessment, decision, fix, verification = current_results()

        result = explain(assessment, decision, fix, verification)

        self.assertEqual(result.action, AUTO_FIX)
        self.assertIn("security regression", result.english)
        self.assertIn("security-tests", result.english)

    def test_auto_fix_roman_urdu_explanation(self):
        assessment, decision, fix, verification = current_results()

        result = explain(assessment, decision, fix, verification)

        self.assertIn("security-tests", result.roman_urdu)
        self.assertIn("ki wajah se", result.roman_urdu)
        self.assertIn("Workflow execution", result.english)

    def test_auto_fix_mentions_detected_issue(self):
        assessment, decision, fix, verification = current_results()

        result = explain(assessment, decision, fix, verification)

        self.assertIn("security-tests gate", result.english)

    def test_auto_fix_mentions_confidence(self):
        assessment, decision, fix, verification = current_results()

        result = explain(assessment, decision, fix, verification)

        self.assertIn("0.97", result.english)
        self.assertIn("97%", result.english)

    def test_auto_fix_mentions_remediation_risk(self):
        assessment, decision, fix, verification = current_results()

        result = explain(assessment, decision, fix, verification)

        self.assertIn("low", result.english.lower())
        self.assertIn("low-risk", result.english.lower())

    def test_auto_fix_accurately_describes_verification(self):
        assessment, decision, fix, verification = current_results()

        result = explain(assessment, decision, fix, verification)

        self.assertIn("YAML parsing passed.", result.english)
        self.assertIn("yamllint passed.", result.english)
        self.assertIn("Change scope passed.", result.english)
        self.assertIn("Overall verification status is passed.", result.english)

    def test_propose_with_caution_warns_change_may_be_intentional(self):
        assessment = load_assessment()
        assessment["remediation_risk"] = "high"
        decision = decide(assessment)

        result = explain(assessment, decision)

        self.assertEqual(result.action, PROPOSE_WITH_CAUTION)
        self.assertIn("may be intentional", result.english)

    def test_propose_with_caution_requires_human_confirmation(self):
        assessment = load_assessment()
        assessment["remediation_risk"] = "high"
        decision = decide(assessment)

        result = explain(assessment, decision)

        self.assertIn("human", result.english.lower())
        self.assertIn("confirm before merging", result.english.lower())
        self.assertIn("did not automatically apply or merge", result.english)

    def test_escalate_describes_uncertainty(self):
        decision = DecisionResult(
            ESCALATE_TO_HUMAN,
            0.62,
            "The assessment has conflicting evidence.",
        )
        assessment = {"reasons": ["A workflow change needs review."]}

        result = explain(assessment, decision)

        self.assertEqual(result.action, ESCALATE_TO_HUMAN)
        self.assertIn("uncertain", result.english.lower())
        self.assertIn("conflicting evidence", result.english)

    def test_escalate_does_not_invent_a_fix(self):
        decision = DecisionResult(
            ESCALATE_TO_HUMAN,
            0.62,
            "The correct remediation is ambiguous.",
        )
        assessment = {"reasons": ["A workflow change needs review."]}

        result = explain(assessment, decision)

        self.assertNotIn("security-tests", result.english)
        self.assertNotIn("restored", result.english.lower())
        self.assertIn("choose the remediation", result.english)

    def test_failed_verification_is_described_as_failed(self):
        assessment = load_assessment()
        decision = decide(assessment)
        verification = VerificationResult(
            FAILED,
            (
                CheckResult("YAML parsing", FAILED, "The generated YAML is invalid."),
                CheckResult("Change scope", PASSED, "Scope passed."),
            ),
        )

        result = explain(assessment, decision, verification=verification)

        self.assertIn("YAML parsing failed", result.english)
        self.assertIn("Overall verification status is failed.", result.english)

    def test_skipped_verification_is_described_as_skipped(self):
        assessment = load_assessment()
        decision = decide(assessment)
        verification = VerificationResult(
            PASSED_WITH_SKIPS,
            (CheckResult("yamllint", SKIPPED, "yamllint is not installed."),),
        )

        result = explain(assessment, decision, verification=verification)

        self.assertIn("yamllint was skipped", result.english)
        self.assertIn("passed with skips", result.english)
        self.assertNotIn("yamllint passed", result.english)

    def test_explanation_does_not_claim_workflow_execution(self):
        assessment, decision, fix, verification = current_results()

        result = explain(assessment, decision, fix, verification)

        self.assertNotIn("workflow executed successfully", result.english.lower())
        self.assertNotIn("github actions succeeded", result.english.lower())
        self.assertIn("runtime behavior", result.english)

    def test_missing_optional_verification_data_is_safe(self):
        assessment, decision, fix, _ = current_results()

        result = explain(assessment, decision, fix, verification=None)

        self.assertIn("verification status is unknown", result.english)
        self.assertNotIn("YAML parsing passed", result.english)

    def test_missing_assessment_information_does_not_invent_facts(self):
        decision = DecisionResult(
            ESCALATE_TO_HUMAN,
            0.40,
            "Required assessment information is missing.",
        )

        result = explain({}, decision)

        self.assertIn("specific details were not provided", result.english)
        self.assertNotIn("security-tests", result.english)
        self.assertNotIn("restored", result.english.lower())

    def test_structured_output_contains_required_fields(self):
        assessment, decision, fix, verification = current_results()

        result = explain(assessment, decision, fix, verification)
        result_dict = result.to_dict()

        self.assertIsInstance(result, ExplanationResult)
        self.assertEqual(
            set(result_dict),
            {"action", "english", "roman_urdu", "reasoning", "review_items"},
        )
        self.assertTrue(result_dict["reasoning"])
        self.assertTrue(result_dict["review_items"])

    def test_missing_fix_does_not_claim_an_applied_change(self):
        assessment, decision, _, verification = current_results()

        result = explain(assessment, decision, fix=None, verification=verification)

        self.assertIn("No generated fix was provided", result.english)
        self.assertNotIn("restored the security-tests job", result.english)


if __name__ == "__main__":
    unittest.main()