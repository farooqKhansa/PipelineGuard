import copy
import sys

import pytest

from authoritative_test_support import authoritative_root


AUTHORITATIVE_ROOT = authoritative_root()
if str(AUTHORITATIVE_ROOT) not in sys.path:
    sys.path.insert(0, str(AUTHORITATIVE_ROOT))

from agent.orchestrator import DEFAULT_WORKFLOW  # noqa: E402
from mocks.load_mock import load_and_validate_mock  # noqa: E402


@pytest.fixture()
def assessment():
    return load_and_validate_mock()


def test_auto_fix_preserves_authoritative_result_and_verification(client, assessment, monkeypatch):
    monkeypatch.setenv("AGENTIC_LAYER_PATH", str(AUTHORITATIVE_ROOT))

    response = client.post(
        "/api/v1/agent/decision",
        json={
            "assessment": assessment,
            "workflow_content": DEFAULT_WORKFLOW,
        },
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    result = payload["agentic_result"]
    agent = payload["agent"]

    assert result["action"] == "AUTO_FIX"
    assert result["deterministic_action"] == "AUTO_FIX"
    assert result["decision"]["action"] == "AUTO_FIX"
    assert result["fix"]["unified_diff"]
    assert result["verification"]["status"] in {"passed", "passed_with_skips"}
    assert result["verification"]["checks"]
    assert agent["fix_diff"] == result["fix"]["unified_diff"]
    assert agent["verification"] == result["verification"]
    assert agent["human_review_required"] == result["human_review_required"]
    assert agent["pr_url"] is None


def test_propose_with_caution_does_not_fabricate_fix_or_verification(client, assessment):
    caution_assessment = copy.deepcopy(assessment)
    caution_assessment["remediation_risk"] = "high"

    response = client.post(
        "/api/v1/agent/decision",
        json={
            "assessment": caution_assessment,
            "workflow_content": DEFAULT_WORKFLOW,
        },
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    result = payload["agentic_result"]

    assert result["action"] == "PROPOSE_WITH_CAUTION"
    assert result["decision"]["action"] == "PROPOSE_WITH_CAUTION"
    assert result["fix"] is None
    assert result["verification"] is None
    assert result["human_review_required"] is True
    assert payload["agent"]["fix_diff"] is None
    assert payload["agent"]["verification"] is None
    assert payload["agent"]["pr_url"] is None


def test_escalation_preserves_real_decision_reason(client, assessment):
    escalation_assessment = copy.deepcopy(assessment)
    escalation_assessment["confidence"] = 0.50

    response = client.post(
        "/api/v1/agent/decision",
        json={
            "assessment": escalation_assessment,
            "workflow_content": DEFAULT_WORKFLOW,
        },
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    result = payload["agentic_result"]

    assert result["action"] == "ESCALATE_TO_HUMAN"
    assert result["decision"]["action"] == "ESCALATE_TO_HUMAN"
    assert result["decision"]["reason"] == "Confidence is below the safe AUTO_FIX threshold."
    assert result["fix"] is None
    assert result["verification"] is None
    assert result["human_review_required"] is True
    assert payload["agent"]["decision_reason"] == result["decision"]["reason"]
    assert payload["agent"]["pr_url"] is None


def test_endpoint_rejects_write_instructions_and_empty_workflow(client, assessment):
    write_request = {
        "assessment": assessment,
        "workflow_content": DEFAULT_WORKFLOW,
        "create_pr": True,
    }
    response = client.post("/api/v1/agent/decision", json=write_request)
    assert response.status_code == 422

    response = client.post(
        "/api/v1/agent/decision",
        json={"assessment": assessment, "workflow_content": " "},
    )
    assert response.status_code == 422