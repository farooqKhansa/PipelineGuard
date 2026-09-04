from copy import deepcopy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from agent.decision import (
    AUTO_FIX,
    ESCALATE_TO_HUMAN,
    PROPOSE_WITH_CAUTION,
)
from agent.orchestrator import DEFAULT_WORKFLOW, orchestrate
from agent.verifier import CheckResult, VerificationResult, FAILED, PASSED
from mocks.load_mock import load_and_validate_mock


class OrchestratorTests(unittest.TestCase):
    def setUp(self):
        self.assessment = load_and_validate_mock()

    def test_complete_auto_fix_flow(self):
        result = orchestrate(
            self.assessment,
            DEFAULT_WORKFLOW,
            audit_id="audit-orchestrator-001",
            timestamp="2026-08-31T16:00:00+00:00",
        )

        self.assertEqual(result.action, AUTO_FIX)
        self.assertIsNotNone(result.fix)
        self.assertIsNotNone(result.verification)
        self.assertIsNotNone(result.explanation)
        self.assertIsNotNone(result.audit)
        self.assertIsNone(result.error)

    def test_auto_fix_generates_a_fix(self):
        result = orchestrate(self.assessment, DEFAULT_WORKFLOW)

        self.assertIsNotNone(result.fix)
        self.assertTrue(result.audit.fix_generated)
        self.assertIn("security-tests", result.fix.unified_diff)

    def test_auto_fix_invokes_verification(self):
        with patch(
            "agent.orchestrator.verify_workflow",
            wraps=__import__(
                "agent.verifier",
                fromlist=["verify_workflow"],
            ).verify_workflow,
        ) as verifier:
            result = orchestrate(self.assessment, DEFAULT_WORKFLOW)

        self.assertIsNotNone(result.verification)
        verifier.assert_called_once()

    def test_successful_verification_is_represented_accurately(self):
        result = orchestrate(self.assessment, DEFAULT_WORKFLOW)

        self.assertEqual(result.verification.status, PASSED)
        self.assertEqual(result.audit.verification_status, PASSED)
        self.assertFalse(result.human_review_required)

    def test_english_explanation_is_included(self):
        result = orchestrate(self.assessment, DEFAULT_WORKFLOW)

        self.assertIn("security-tests", result.explanation.english)
        self.assertEqual(
            result.audit.english_explanation,
            result.explanation.english,
        )

    def test_roman_urdu_explanation_is_included(self):
        result = orchestrate(self.assessment, DEFAULT_WORKFLOW)

        self.assertIn("ki wajah se", result.explanation.roman_urdu)
        self.assertEqual(
            result.audit.roman_urdu_explanation,
            result.explanation.roman_urdu,
        )

    def test_audit_record_is_produced(self):
        result = orchestrate(self.assessment, DEFAULT_WORKFLOW)

        self.assertEqual(result.audit.selected_action, AUTO_FIX)
        self.assertTrue(result.audit.fix_generated)
        self.assertIsNotNone(result.audit.fix_diff)

    def test_propose_with_caution_does_not_apply_a_fix(self):
        assessment = deepcopy(self.assessment)
        assessment["remediation_risk"] = "high"

        result = orchestrate(assessment, DEFAULT_WORKFLOW)

        self.assertEqual(result.action, PROPOSE_WITH_CAUTION)
        self.assertIsNone(result.fix)
        self.assertIsNone(result.verification)
        self.assertFalse(result.audit.fix_generated)
        self.assertEqual(result.audit.verification_status, "unknown")
        self.assertTrue(result.human_review_required)
        self.assertIn("Human confirmation", result.explanation.english)

    def test_escalate_to_human_does_not_generate_an_automatic_fix(self):
        assessment = deepcopy(self.assessment)
        assessment["confidence"] = 0.50

        result = orchestrate(assessment, DEFAULT_WORKFLOW)

        self.assertEqual(result.action, ESCALATE_TO_HUMAN)
        self.assertIsNone(result.fix)
        self.assertIsNone(result.verification)
        self.assertFalse(result.audit.fix_generated)
        self.assertTrue(result.human_review_required)

    def test_failed_verification_remains_failed(self):
        failed = VerificationResult(
            FAILED,
            (
                CheckResult(
                    "YAML parsing",
                    FAILED,
                    "The generated YAML is invalid.",
                ),
            ),
        )
        with patch("agent.orchestrator.verify_workflow", return_value=failed):
            result = orchestrate(self.assessment, DEFAULT_WORKFLOW)

        self.assertEqual(result.verification.status, FAILED)
        self.assertEqual(result.audit.verification_status, FAILED)
        self.assertTrue(result.human_review_required)

    def test_missing_verification_remains_unknown(self):
        with patch("agent.orchestrator.verify_workflow", return_value=None):
            result = orchestrate(self.assessment, DEFAULT_WORKFLOW)

        self.assertIsNone(result.verification)
        self.assertEqual(result.audit.verification_status, "unknown")
        self.assertTrue(result.human_review_required)

    def test_invalid_assessment_fails_safely(self):
        result = orchestrate(None, DEFAULT_WORKFLOW)

        self.assertEqual(result.action, ESCALATE_TO_HUMAN)
        self.assertIsNone(result.fix)
        self.assertTrue(result.human_review_required)
        self.assertIn("Invalid assessment", result.error)
        self.assertEqual(result.audit.selected_action, ESCALATE_TO_HUMAN)

    def test_fix_generation_failure_does_not_fabricate_a_fix(self):
        with patch(
            "agent.orchestrator.generate_fix",
            side_effect=ValueError("controlled generator failure"),
        ):
            result = orchestrate(self.assessment, DEFAULT_WORKFLOW)

        self.assertEqual(result.action, AUTO_FIX)
        self.assertIsNone(result.fix)
        self.assertIsNone(result.verification)
        self.assertFalse(result.audit.fix_generated)
        self.assertNotIn("fix_diff", result.audit.to_dict())
        self.assertIn("Fix generation failed", result.error)

    def test_audit_record_can_be_persisted_by_orchestrator(self):
        with tempfile.TemporaryDirectory() as directory:
            result = orchestrate(
                self.assessment,
                DEFAULT_WORKFLOW,
                audit_directory=directory,
                audit_id="audit-persisted-001",
                timestamp="2026-08-31T16:01:00+00:00",
            )

            self.assertTrue(result.audit_persisted)
            self.assertTrue(result.audit_path.is_file())
            persisted = json.loads(result.audit_path.read_text())
            self.assertEqual(persisted["audit_id"], "audit-persisted-001")

    def test_cli_executes_complete_mock_flow(self):
        completed = subprocess.run(
            [sys.executable, "-m", "agent.orchestrator"],
            check=False,
            capture_output=True,
            text=True,
        )

        self.assertEqual(completed.returncode, 0, completed.stderr)
        output = json.loads(completed.stdout)
        self.assertEqual(output["action"], AUTO_FIX)
        self.assertEqual(output["verification_status"], PASSED)
        self.assertTrue(output["audit_created"])
        self.assertEqual(
            output["stages"],
            [
                "assessment",
                "decision",
                "fix",
                "verification",
                "explanation",
                "audit",
            ],
        )


if __name__ == "__main__":
    unittest.main()