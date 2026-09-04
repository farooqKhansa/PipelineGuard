from unittest.mock import patch
import unittest

from agent.fix_generator import generate_fix
from agent.verifier import (
    FAILED,
    PASSED,
    PASSED_WITH_SKIPS,
    SKIPPED,
    verify_workflow,
)
import json
from pathlib import Path


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


def generated_workflow():
    return generate_fix(ORIGINAL_WORKFLOW, load_assessment()).fixed_workflow


class VerifierTests(unittest.TestCase):
    def test_valid_generated_workflow_passes_yaml_parsing(self):
        result = verify_workflow(ORIGINAL_WORKFLOW, generated_workflow())

        yaml_check = next(check for check in result.checks if check.name == "YAML parsing")
        self.assertEqual(yaml_check.status, PASSED)

    def test_invalid_yaml_fails_yaml_parsing(self):
        invalid_workflow = "jobs:\n  test: [\n"

        result = verify_workflow(ORIGINAL_WORKFLOW, invalid_workflow)

        yaml_check = next(check for check in result.checks if check.name == "YAML parsing")
        self.assertEqual(yaml_check.status, FAILED)
        self.assertEqual(result.status, FAILED)

    def test_yamllint_passes_when_available(self):
        completed = type(
            "CompletedProcess",
            (),
            {"returncode": 0, "stdout": "", "stderr": ""},
        )()

        with patch("agent.verifier.shutil.which", return_value="/usr/bin/yamllint"):
            with patch("agent.verifier.subprocess.run", return_value=completed) as run:
                result = verify_workflow(ORIGINAL_WORKFLOW, generated_workflow())

        lint_check = next(check for check in result.checks if check.name == "yamllint")
        self.assertEqual(lint_check.status, PASSED)
        run.assert_called_once()

    def test_yamllint_is_explicitly_skipped_when_unavailable(self):
        with patch("agent.verifier.shutil.which", return_value=None):
            result = verify_workflow(ORIGINAL_WORKFLOW, generated_workflow())

        lint_check = next(check for check in result.checks if check.name == "yamllint")
        self.assertEqual(lint_check.status, SKIPPED)
        self.assertIn("not installed", lint_check.message)
        self.assertEqual(result.status, PASSED_WITH_SKIPS)

    def test_missing_security_tests_job_fails_change_scope(self):
        result = verify_workflow(ORIGINAL_WORKFLOW, ORIGINAL_WORKFLOW)

        scope_check = next(check for check in result.checks if check.name == "Change scope")
        self.assertEqual(scope_check.status, FAILED)
        self.assertEqual(result.status, FAILED)

    def test_correct_security_tests_restoration_passes_change_scope(self):
        result = verify_workflow(ORIGINAL_WORKFLOW, generated_workflow())

        scope_check = next(check for check in result.checks if check.name == "Change scope")
        self.assertEqual(scope_check.status, PASSED)

    def test_original_security_tests_job_is_rejected(self):
        fixed = generated_workflow()

        result = verify_workflow(fixed, fixed)

        scope_check = next(check for check in result.checks if check.name == "Change scope")
        self.assertEqual(scope_check.status, FAILED)
        self.assertIn("already contains", scope_check.message)

    def test_verification_result_contains_structured_check_results(self):
        result = verify_workflow(ORIGINAL_WORKFLOW, generated_workflow())

        self.assertIn(result.status, {PASSED, PASSED_WITH_SKIPS, FAILED})
        self.assertEqual(
            {check.name for check in result.checks},
            {"YAML parsing", "yamllint", "Change scope"},
        )
        self.assertTrue(all(check.status in {PASSED, FAILED, SKIPPED} for check in result.checks))
        result_dict = result.to_dict()
        self.assertIn("status", result_dict)
        self.assertEqual(len(result_dict["checks"]), 3)

    def test_failed_required_check_produces_failed_overall_status(self):
        invalid_workflow = generated_workflow().replace(
            "run: ./scripts/security-tests.sh",
            "run: [",
        )

        result = verify_workflow(ORIGINAL_WORKFLOW, invalid_workflow)

        self.assertEqual(result.status, FAILED)

    def test_skipped_linting_does_not_claim_full_verification(self):
        with patch("agent.verifier.shutil.which", return_value=None):
            result = verify_workflow(ORIGINAL_WORKFLOW, generated_workflow())

        self.assertEqual(result.status, PASSED_WITH_SKIPS)
        self.assertNotEqual(result.status, "passed")
        self.assertNotIn("verified", result.to_dict())

    def test_unrelated_workflow_change_fails_change_scope(self):
        changed_workflow = generated_workflow().replace(
            "./scripts/deploy.sh", "./scripts/other-deploy.sh"
        )

        result = verify_workflow(ORIGINAL_WORKFLOW, changed_workflow)

        scope_check = next(check for check in result.checks if check.name == "Change scope")
        self.assertEqual(scope_check.status, FAILED)


if __name__ == "__main__":
    unittest.main()