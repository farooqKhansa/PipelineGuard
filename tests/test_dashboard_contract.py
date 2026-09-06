import pytest

LIST_ENDPOINTS = [
    "/api/v1/overview",
    "/api/v1/investigations",
    "/api/v1/findings",
    "/api/v1/fixes",
    "/api/v1/repositories",
    "/api/v1/pipelines",
    "/api/v1/runs",
    "/api/v1/trends",
    "/api/v1/alerts",
    "/api/v1/reviews",
    "/api/v1/audit",
    "/api/v1/policies",
    "/api/v1/team",
    "/api/v1/integrations",
    "/api/v1/agent",
    "/api/v1/patterns",
    "/api/v1/incidents",
    "/api/v1/feed",
    "/api/v1/replay/cassettes",
]


@pytest.mark.parametrize("path", LIST_ENDPOINTS)
def test_list_endpoints_return_200(client, path):
    resp = client.get(path)
    assert resp.status_code == 200, resp.text


def test_overview_shape(client):
    data = client.get("/api/v1/overview").json()
    for key in ["stats", "openFindings", "criticalFindings", "monitoredRepos", "recentRuns", "trends"]:
        assert key in data


def test_investigation_detail_includes_fix(client):
    investigations = client.get("/api/v1/investigations").json()
    with_fix = [i for i in investigations if i["fix"] is not None]
    assert with_fix, "seed data should include at least one investigation with a fix"
    detail = client.get(f"/api/v1/investigations/{with_fix[0]['id']}").json()
    assert detail["fix"]["id"] == with_fix[0]["fix"]["id"]


def test_not_found_returns_404(client):
    resp = client.get("/api/v1/findings/does-not-exist")
    assert resp.status_code == 404


def test_cors_headers_present_for_allowed_origin(client):
    resp = client.get("/api/v1/overview", headers={"Origin": "http://localhost:3000"})
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"
