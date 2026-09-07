import pytest


@pytest.mark.parametrize(
    "scenario_id,expected_decision,expected_status",
    [
        (1, "refused", "failed"),
        (2, "refused", "failed"),
        (3, "refused", "failed"),
    ],
)
def test_demo_scenarios_are_deterministic(client, scenario_id, expected_decision, expected_status):
    resp = client.post(f"/api/v1/demo/scenario/{scenario_id}")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["decisions"] == [expected_decision]
    assert data["status"] == expected_status

    trace = client.get(f"/api/v1/runs/{data['runId']}/trace")
    assert trace.status_code == 200
    events = trace.json()["events"]
    assert events[0]["stage"] == "webhook_received"
    assert any(e["stage"] == "agent_completed" for e in events)


def test_demo_scenario_unknown_id_404(client):
    resp = client.post("/api/v1/demo/scenario/99")
    assert resp.status_code == 404


def test_demo_scenario_1_does_not_create_pr_without_authoritative_input(client):
    resp = client.post("/api/v1/demo/scenario/1")
    run_id = resp.json()["runId"]
    trace = client.get(f"/api/v1/runs/{run_id}/trace").json()
    stages = [e["stage"] for e in trace["events"]]
    assert "fix_created" not in stages
    assert "pr_created" not in stages
