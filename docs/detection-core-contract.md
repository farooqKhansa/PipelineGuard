# Detection Core HTTP Contract

The dashboard calls `POST {DETECTION_CORE_URL}/detect`. The request body is:

```json
{
  "repo": "owner/repository",
  "workflow_run_id": "run-id",
  "diff": "complete workflow content"
}
```

## Minimum valid response

```json
{
  "status": "clean",
  "risk_score": 0.0
}
```

`status` must be `clean`, `suspicious`, or `malicious`. `risk_score` must be a
finite numeric probability from `0` through `1`. The gateway never rescales
this external response.

## Optional canonical evidence

A future Detection Core may add any of these fields:

```json
{
  "confidence": 0.97,
  "reasons": [],
  "affected_jobs": [],
  "graph_path": [],
  "model_breakdown": {},
  "diff": "...",
  "remediation_risk": "low",
  "remediation_unambiguous": true
}
```

They are optional at the HTTP boundary. Missing fields stay missing and are
passed to the authoritative Workstream 2 policy, which decides whether the
assessment can be acted on.

## Gateway observability metadata

Valid responses receive:

```json
{
  "source": "external_detection_core",
  "contract_version": "v1",
  "detection_status": "complete_for_detection",
  "agentic_evidence_status": "incomplete",
  "risk_score_scale": "0-1",
  "available_evidence": ["risk_score"],
  "missing_evidence": ["confidence", "reasons"]
}
```

`detection_status` is `complete_for_detection` for the minimum response and
`complete` only when all canonical evidence fields are present. These metadata
fields describe the result; they do not bypass Workstream 2 validation.

Unavailable Detection Core responses use `detection_status: "unavailable"` and
contain no score. Invalid responses use `detection_status: "invalid_response"`
and include validation errors, also without retaining an invalid score.

Demo fallback responses are explicitly marked with `source: "demo"` and
`demo_mode: true`. They are not used by the live `/api/v1/analyze` path.