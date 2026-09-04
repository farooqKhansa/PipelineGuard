import copy
import json
from pathlib import Path
import unittest

from agent.fix_generator import (
    FixGenerationError,
    generate_fix,
)


MOCK_PATH = (
    Path(__file__).resolve().parents[1] / "mocks" / "risk_assessment_auto_fix.json"
)

WORKFLOW_CONTENT = """name: CI

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

SECURITY_TESTS_JOB = """  security-tests:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run security tests
        run: ./scripts/security-tests.sh"""


def load_assessment():
    with MOCK_PATH.open(encoding="utf-8") as mock_file:
        return json.load(mock_file)


class FixGeneratorTests(unittest.TestCase):
    def test_valid_auto_fix_assessment_generates_expected_fix(self):
        result = generate_fix(WORKFLOW_CONTENT, load_assessment())

        self.assertEqual(result.original_workflow, WORKFLOW_CONTENT)
        self.assertIn(SECURITY_TESTS_JOB, result.fixed_workflow)
        self.assertIn("  deploy:\n", result.fixed_workflow)

    def test_generated_result_contains_unified_diff(self):
        result = generate_fix(WORKFLOW_CONTENT, load_assessment())

        self.assertIn("--- a/.github/workflows/ci.yml", result.unified_diff)
        self.assertIn("+++ b/.github/workflows/ci.yml", result.unified_diff)
        self.assertIn("@@", result.unified_diff)
        self.assertIn("+  security-tests:", result.unified_diff)

    def test_security_tests_job_is_restored_from_assessment_evidence(self):
        result = generate_fix(WORKFLOW_CONTENT, load_assessment())

        self.assertEqual(result.fixed_workflow.count("security-tests:"), 1)
        self.assertIn("needs: test", result.fixed_workflow)
        self.assertIn("./scripts/security-tests.sh", result.fixed_workflow)

    def test_unrelated_workflow_content_remains_unchanged(self):
        result = generate_fix(WORKFLOW_CONTENT, load_assessment())

        self.assertIn("name: CI\n", result.fixed_workflow)
        self.assertIn("      - run: ./scripts/test.sh\n", result.fixed_workflow)
        self.assertIn("  deploy:\n    needs: test\n", result.fixed_workflow)
        self.assertIn("      - name: Deploy\n        run: ./scripts/deploy.sh\n", result.fixed_workflow)

    def test_low_confidence_refuses_to_generate_fix(self):
        assessment = load_assessment()
        assessment["confidence"] = 0.89

        with self.assertRaises(FixGenerationError):
            generate_fix(WORKFLOW_CONTENT, assessment)

    def test_high_remediation_risk_refuses_to_generate_fix(self):
        assessment = load_assessment()
        assessment["remediation_risk"] = "high"

        with self.assertRaises(FixGenerationError):
            generate_fix(WORKFLOW_CONTENT, assessment)

    def test_ambiguous_remediation_refuses_to_generate_fix(self):
        assessment = load_assessment()
        assessment["remediation_unambiguous"] = False

        with self.assertRaises(FixGenerationError):
            generate_fix(WORKFLOW_CONTENT, assessment)

    def test_missing_workflow_content_refuses_to_generate_fix(self):
        with self.assertRaises(FixGenerationError):
            generate_fix("", load_assessment())

    def test_missing_evidence_refuses_to_generate_fix(self):
        assessment = load_assessment()
        assessment.pop("diff")

        with self.assertRaises(FixGenerationError):
            generate_fix(WORKFLOW_CONTENT, assessment)

    def test_generated_result_does_not_claim_verification(self):
        result = generate_fix(WORKFLOW_CONTENT, load_assessment())

        self.assertFalse(hasattr(result, "verification"))
        self.assertFalse(hasattr(result, "verified"))
        self.assertNotIn("verified", result.unified_diff.lower())

    def test_input_assessment_is_not_modified(self):
        assessment = load_assessment()
        original_assessment = copy.deepcopy(assessment)

        generate_fix(WORKFLOW_CONTENT, assessment)

        self.assertEqual(assessment, original_assessment)


if __name__ == "__main__":
    unittest.main()