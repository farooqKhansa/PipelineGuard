import json
from pathlib import Path
import tempfile
import unittest

from audit.logger import AuditLogger, create_audit_record, write_audit_record
from audit.schemas import AuditRecord


ASSESSMENT = {
    "issue_id": "issue-security-gate-001",
    "risk_score": 0.91,
    "confidence": 0.97,
    "repo": "demo-org/pipelineguard-fixtures",
    "workflow_run_id": "demo-run-2026-08-31-0042",
    "remediation_risk": "low",
    "remediation_unambiguous": True,
}

DECISION = {
    "action": "AUTO_FIX",
    "confidence": 0.97,
    "reason": "High confidence and low remediation risk.",
}

FIX = {
    "fix_generated": True,
    "unified_diff": "+  security-tests:\n+    needs: test\n",
}

VERIFICATION = {
    "status": "passed",
    "checks": [
        {
            "name": "YAML parsing",
            "status": "passed",
            "message": "Generated workflow parsed.",
        },
        {
            "name": "yamllint",
            "status": "passed",
            "message": "yamllint completed.",
        },
    ],
}

EXPLANATION = {
    "english": "The security-tests gate was restored.",
    "roman_urdu": "Security-tests gate restore kar di gayi hai.",
    "reasoning": ["The decision was AUTO_FIX."],
    "review_items": ["Review the generated diff."],
}


def complete_record(**overrides):
    values = {
        "assessment": ASSESSMENT,
        "decision": DECISION,
        "fix": FIX,
        "verification": VERIFICATION,
        "explanation": EXPLANATION,
        "audit_id": "audit-test-001",
        "timestamp": "2026-08-31T15:00:00+00:00",
    }
    values.update(overrides)
    return create_audit_record(**values)


class AuditTests(unittest.TestCase):
    def test_complete_auto_fix_record_can_be_created(self):
        record = complete_record()

        self.assertIsInstance(record, AuditRecord)
        self.assertEqual(record.audit_id, "audit-test-001")
        self.assertEqual(record.repository, ASSESSMENT["repo"])

    def test_record_contains_selected_action(self):
        self.assertEqual(complete_record().selected_action, "AUTO_FIX")

    def test_record_contains_confidence(self):
        self.assertEqual(complete_record().confidence, 0.97)

    def test_record_contains_remediation_risk(self):
        self.assertEqual(complete_record().remediation_risk, "low")
        self.assertTrue(complete_record().remediation_unambiguous)

    def test_record_contains_generated_diff(self):
        record = complete_record()

        self.assertTrue(record.fix_generated)
        self.assertEqual(record.fix_diff, FIX["unified_diff"])

    def test_record_contains_verification_status(self):
        self.assertEqual(complete_record().verification_status, "passed")

    def test_record_contains_individual_verification_checks(self):
        data = complete_record().to_dict()

        self.assertEqual(len(data["verification_checks"]), 2)
        self.assertEqual(data["verification_checks"][0]["name"], "YAML parsing")
        self.assertEqual(data["verification_checks"][1]["status"], "passed")

    def test_record_contains_english_explanation(self):
        self.assertEqual(
            complete_record().english_explanation,
            EXPLANATION["english"],
        )

    def test_record_contains_roman_urdu_explanation(self):
        self.assertEqual(
            complete_record().roman_urdu_explanation,
            EXPLANATION["roman_urdu"],
        )

    def test_missing_optional_fields_are_omitted_safely(self):
        record = create_audit_record(
            assessment={"repo": "demo/repo"},
            decision={"action": "ESCALATE_TO_HUMAN", "confidence": 0.42},
            audit_id="audit-missing-001",
            timestamp="2026-08-31T15:01:00+00:00",
        )
        data = record.to_dict()

        self.assertEqual(data["selected_action"], "ESCALATE_TO_HUMAN")
        self.assertNotIn("issue_id", data)
        self.assertNotIn("fix_diff", data)
        self.assertNotIn("english_explanation", data)
        self.assertEqual(data["verification_status"], "unknown")
        self.assertEqual(data["verification_checks"], [])

    def test_no_hidden_chain_of_thought_field_exists(self):
        data = complete_record().to_dict()

        forbidden = {
            "chain_of_thought",
            "private_reasoning",
            "hidden_reasoning",
        }
        self.assertTrue(forbidden.isdisjoint(data))

    def test_record_serializes_to_dictionary(self):
        data = complete_record().to_dict()

        self.assertIsInstance(data, dict)
        self.assertEqual(data["audit_id"], "audit-test-001")
        self.assertEqual(data["workflow_run_id"], ASSESSMENT["workflow_run_id"])

    def test_record_serializes_to_valid_json(self):
        encoded = complete_record().to_json()
        decoded = json.loads(encoded)

        self.assertEqual(decoded["selected_action"], "AUTO_FIX")
        self.assertEqual(decoded["verification_status"], "passed")

    def test_record_can_be_written_to_disk(self):
        record = complete_record()
        with tempfile.TemporaryDirectory() as temp_dir:
            path = write_audit_record(record, temp_dir)

            self.assertTrue(path.is_file())
            self.assertEqual(path.parent, Path(temp_dir))
            self.assertEqual(json.loads(path.read_text())["audit_id"], record.audit_id)

    def test_repeated_writes_do_not_overwrite_previous_records(self):
        record = complete_record()
        with tempfile.TemporaryDirectory() as temp_dir:
            first = write_audit_record(record, temp_dir)
            second = write_audit_record(record, temp_dir)

            self.assertNotEqual(first, second)
            self.assertTrue(first.is_file())
            self.assertTrue(second.is_file())
            self.assertEqual(
                len(list(Path(temp_dir).glob("audit-test-001*.json"))),
                2,
            )

    def test_failed_verification_remains_failed(self):
        verification = {
            "status": "failed",
            "checks": [
                {
                    "name": "YAML parsing",
                    "status": "failed",
                    "message": "The generated YAML is invalid.",
                }
            ],
        }
        record = complete_record(verification=verification)

        self.assertEqual(record.verification_status, "failed")
        self.assertEqual(record.verification_checks[0].status, "failed")

    def test_skipped_verification_remains_skipped_with_skips(self):
        verification = {
            "status": "passed_with_skips",
            "checks": [
                {
                    "name": "yamllint",
                    "status": "skipped",
                    "message": "yamllint is not installed.",
                }
            ],
        }
        record = complete_record(verification=verification)

        self.assertEqual(record.verification_status, "passed_with_skips")
        self.assertEqual(record.verification_checks[0].status, "skipped")

    def test_missing_verification_becomes_unknown(self):
        record = complete_record(verification=None)

        self.assertEqual(record.verification_status, "unknown")
        self.assertEqual(record.verification_checks, ())

    def test_no_fix_generated_means_no_fabricated_diff(self):
        record = complete_record(fix=None)
        data = record.to_dict()

        self.assertFalse(record.fix_generated)
        self.assertIsNone(record.fix_diff)
        self.assertNotIn("fix_diff", data)

    def test_logger_wrapper_creates_and_writes_record(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            logger = AuditLogger(temp_dir)
            record, path = logger.log(
                assessment=ASSESSMENT,
                decision=DECISION,
                audit_id="audit-wrapper-001",
                timestamp="2026-08-31T15:02:00+00:00",
            )

            self.assertEqual(record.audit_id, "audit-wrapper-001")
            self.assertTrue(path.is_file())


if __name__ == "__main__":
    unittest.main()