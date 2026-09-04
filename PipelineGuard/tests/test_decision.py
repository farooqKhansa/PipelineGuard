import json
from pathlib import Path
import unittest

from agent.decision import (
    AUTO_FIX,
    ESCALATE_TO_HUMAN,
    PROPOSE_WITH_CAUTION,
    decide,
)


MOCK_PATH = (
    Path(__file__).resolve().parents[1] / "mocks" / "risk_assessment_auto_fix.json"
)


def assessment_with(**overrides):
    assessment = {
        "risk_score": 0.91,
        "confidence": 0.97,
        "reasons": ["The security gate was removed from the workflow."],
        "affected_jobs": ["security-tests"],
        "graph_path": ["test", "security-tests", "deploy"],
        "model_breakdown": {
            "pipeline_score": 0.93,
            "code_score": 0.88,
            "combined_score": 0.91,
        },
        "repo": "demo-org/pipelineguard-fixtures",
        "workflow_run_id": "demo-run-2026-08-31-0042",
        "diff": "- security-tests\n+ security-tests",
        "remediation_risk": "low",
        "remediation_unambiguous": True,
    }
    assessment.update(overrides)
    return assessment


class DecisionEngineTests(unittest.TestCase):
    def test_existing_mock_is_auto_fix_candidate(self):
        with MOCK_PATH.open(encoding="utf-8") as mock_file:
            assessment = json.load(mock_file)

        result = decide(assessment)

        self.assertEqual(result.action, AUTO_FIX)
        self.assertEqual(result.confidence, 0.97)

    def test_high_confidence_low_remediation_impact_allows_auto_fix(self):
        result = decide(
            assessment_with(
                risk_score=0.99,
                confidence=0.90,
                remediation_risk="low",
            )
        )

        self.assertEqual(result.action, AUTO_FIX)

    def test_high_confidence_high_impact_change_requires_caution(self):
        result = decide(
            assessment_with(
                remediation_risk="high",
            )
        )

        self.assertEqual(result.action, PROPOSE_WITH_CAUTION)
        self.assertNotEqual(result.action, AUTO_FIX)

    def test_low_confidence_escalates(self):
        result = decide(assessment_with(confidence=0.89))

        self.assertEqual(result.action, ESCALATE_TO_HUMAN)

    def test_missing_remediation_information_escalates(self):
        assessment = assessment_with()
        del assessment["remediation_risk"]

        result = decide(assessment)

        self.assertEqual(result.action, ESCALATE_TO_HUMAN)
        self.assertNotEqual(result.action, AUTO_FIX)

    def test_missing_evidence_escalates(self):
        result = decide(assessment_with(reasons=[]))

        self.assertEqual(result.action, ESCALATE_TO_HUMAN)

    def test_confidence_threshold_is_inclusive(self):
        at_threshold = decide(assessment_with(confidence=0.90))
        below_threshold = decide(assessment_with(confidence=0.899999))

        self.assertEqual(at_threshold.action, AUTO_FIX)
        self.assertEqual(below_threshold.action, ESCALATE_TO_HUMAN)


if __name__ == "__main__":
    unittest.main()