"""
Small concurrency smoke test: fires 10 concurrent GET requests at a mix of
read endpoints and asserts the backend stays stable (no 5xx, no exceptions).
This is not a performance benchmark -- it's the "does it fall over" check
required by the spec.
"""
import concurrent.futures

ENDPOINTS = [
    "/api/v1/overview",
    "/api/v1/investigations",
    "/api/v1/findings",
    "/api/v1/pipelines",
    "/api/v1/runs",
    "/api/v1/trends",
    "/api/v1/agent",
    "/health",
]


def test_concurrent_requests_stay_stable(client):
    def hit(path):
        r = client.get(path)
        return path, r.status_code

    paths = (ENDPOINTS * 2)[:10]
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        results = list(pool.map(hit, paths))

    for path, status in results:
        assert status == 200, f"{path} returned {status}"
