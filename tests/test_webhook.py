import hashlib
import hmac
import json

SECRET = "test-secret"


def _sign(body: bytes) -> str:
    return "sha256=" + hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()


def _payload(repo="acme-corp/checkout-service", delivery="d-1"):
    return {
        "repository": {"full_name": repo},
        "ref": "refs/heads/main",
        "after": "abc1234",
        "head_commit": {"message": "test commit", "author": {"name": "tester"}},
        "workflow_run": {"id": 555, "path": ".github/workflows/ci.yml", "head_sha": "abc1234", "head_branch": "main"},
    }


def test_webhook_valid_signature_processes_and_persists(client):
    body = json.dumps(_payload(delivery="wh-valid-1")).encode()
    resp = client.post(
        "/api/v1/webhooks/github",
        data=body,
        headers={
            "X-Hub-Signature-256": _sign(body),
            "X-GitHub-Event": "workflow_run",
            "X-GitHub-Delivery": "wh-valid-1",
            "Content-Type": "application/json",
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["status"] == "processed"
    run_id = data["run_id"]

    run = client.get(f"/api/v1/runs/{run_id}")
    assert run.status_code == 200

    trace = client.get(f"/api/v1/runs/{run_id}/trace").json()
    stages = [e["stage"] for e in trace["events"]]
    assert "webhook_received" in stages
    assert "detection_completed" in stages
    assert "agent_completed" in stages


def test_webhook_invalid_signature_rejected(client):
    body = json.dumps(_payload(delivery="wh-bad-sig")).encode()
    resp = client.post(
        "/api/v1/webhooks/github",
        data=body,
        headers={
            "X-Hub-Signature-256": "sha256=0000000000",
            "X-GitHub-Event": "workflow_run",
            "X-GitHub-Delivery": "wh-bad-sig",
            "Content-Type": "application/json",
        },
    )
    assert resp.status_code == 401


def test_webhook_idempotent_on_duplicate_delivery(client):
    body = json.dumps(_payload(delivery="wh-dup-1")).encode()
    headers = {
        "X-Hub-Signature-256": _sign(body),
        "X-GitHub-Event": "workflow_run",
        "X-GitHub-Delivery": "wh-dup-1",
        "Content-Type": "application/json",
    }
    first = client.post("/api/v1/webhooks/github", data=body, headers=headers)
    second = client.post("/api/v1/webhooks/github", data=body, headers=headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["status"] == "duplicate"
    assert second.json()["run_id"] == first.json()["run_id"]


def test_webhook_missing_delivery_id_rejected(client):
    body = json.dumps(_payload()).encode()
    resp = client.post(
        "/api/v1/webhooks/github",
        data=body,
        headers={"X-Hub-Signature-256": _sign(body), "X-GitHub-Event": "workflow_run", "Content-Type": "application/json"},
    )
    assert resp.status_code == 400
