"""
Converts SQLAlchemy rows into the exact camelCase JSON shapes defined in the
frontend's `src/lib/types.ts`. This is the ONLY place that shape matters --
routers just call these and return the result.
"""
from datetime import datetime, timezone


def iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


def bilingual(d: dict | None) -> dict:
    if not d:
        return {"en": "", "ur": ""}
    return {"en": d.get("en", ""), "ur": d.get("ur", "")}


def repository(r) -> dict:
    open_findings = sum(1 for f in r.findings if f.status in ("open", "in_review"))
    critical_findings = sum(1 for f in r.findings if f.severity == "critical" and f.status != "fixed")
    return {
        "id": r.id,
        "name": r.name,
        "fullName": r.full_name,
        "provider": r.provider,
        "defaultBranch": r.default_branch,
        "private": r.private,
        "language": r.language,
        "pipelineCount": len(r.pipelines),
        "openFindings": open_findings,
        "criticalFindings": critical_findings,
        "healthScore": r.health_score,
        "lastActivity": iso(r.last_activity),
        "monitored": r.monitored,
    }


def pipeline_job(j) -> dict:
    return {
        "id": j.id,
        "name": j.name,
        "needs": j.needs or [],
        "permissions": j.permissions or {},
        "secrets": j.secrets or [],
        "environment": j.environment,
        "steps": j.steps,
        "avgDurationMs": j.avg_duration_ms,
        "findingIds": j.finding_ids or [],
    }


def pipeline(p) -> dict:
    open_findings = sum(1 for j in p.jobs for _ in (j.finding_ids or []))
    return {
        "id": p.id,
        "name": p.name,
        "repo": p.repository.full_name if p.repository else "",
        "provider": p.provider,
        "filePath": p.file_path,
        "touchesProduction": p.touches_production,
        "jobs": [pipeline_job(j) for j in p.jobs],
        "environments": p.environments or [],
        "secretsUsed": p.secrets_used or [],
        "openFindings": open_findings,
        "passRate": p.pass_rate,
        "lastRun": iso(p.last_run),
        "healthScore": p.health_score,
    }


def pipeline_run(run) -> dict:
    return {
        "id": run.id,
        "number": run.number,
        "pipelineId": run.pipeline_id,
        "pipelineName": run.pipeline.name if run.pipeline else "",
        "repo": run.pipeline.repository.full_name if run.pipeline and run.pipeline.repository else "",
        "status": run.status,
        "branch": run.branch,
        "commit": run.commit,
        "commitMessage": run.commit_message,
        "author": run.author,
        "startedAt": iso(run.started_at),
        "durationMs": run.duration_ms,
        "riskScore": run.risk_score,
        "findingIds": run.finding_ids or [],
        "decisions": run.decisions or [],
    }


def finding(f, pipeline_name: str = "") -> dict:
    return {
        "id": f.id,
        "ruleId": f.rule_id,
        "title": bilingual(f.title),
        "description": bilingual(f.description),
        "severity": f.severity,
        "status": f.status,
        "repo": f.repository.full_name if f.repository else "",
        "pipelineId": f.pipeline_id,
        "pipelineName": pipeline_name,
        "filePath": f.file_path,
        "line": f.line,
        "jobId": f.job_id,
        "detectedAt": iso(f.detected_at),
        "resolvedAt": iso(f.resolved_at),
        "investigationId": f.investigation_id,
        "impact": bilingual(f.impact),
        "category": f.category,
        "cwe": f.cwe,
    }


def investigation(inv) -> dict:
    return {
        "id": inv.id,
        "findingId": inv.finding_id,
        "title": bilingual(inv.title),
        "repo": inv.repo,
        "pipeline": inv.pipeline,
        "pipelineId": inv.pipeline_id,
        "runId": inv.run_id,
        "commit": inv.commit,
        "commitMessage": inv.commit_message,
        "author": inv.author,
        "branch": inv.branch,
        "filePath": inv.file_path,
        "severity": inv.severity,
        "decision": inv.decision,
        "confidence": inv.confidence,
        "startedAt": iso(inv.started_at),
        "durationMs": inv.duration_ms,
        "steps": inv.steps or [],
        "fix": None,  # populated by router (joins Fix table by inv.fix_id)
        "gaps": inv.gaps or [],
        "hypotheses": inv.hypotheses or [],
        "thresholds": inv.thresholds or {"autoFixFloor": 90, "recommendFloor": 60},
        "similarChanges": inv.similar_changes or [],
    }


def fix(x) -> dict:
    return {
        "id": x.id,
        "investigationId": x.investigation_id,
        "title": bilingual(x.title),
        "filePath": x.file_path,
        "hunks": x.hunks or [],
        "prevents": bilingual(x.prevents),
        "rationale": bilingual(x.rationale),
        "validation": x.validation or {"verified": False, "checks": [], "method": bilingual(None)},
        "status": x.status,
        "pullRequest": x.pull_request,
        **({"revertReason": bilingual(x.revert_reason)} if x.revert_reason else {}),
    }


def alert(a) -> dict:
    return {
        "id": a.id,
        "title": bilingual(a.title),
        "severity": a.severity,
        "kind": a.kind,
        "repo": a.repo,
        "createdAt": iso(a.created_at),
        "read": a.read,
        "investigationId": a.investigation_id,
        "findingId": a.finding_id,
        "body": bilingual(a.body),
    }


def review_item(r) -> dict:
    return {
        "id": r.id,
        "fixId": r.fix_id,
        "investigationId": r.investigation_id,
        "title": bilingual(r.title),
        "repo": r.repo,
        "severity": r.severity,
        "requestedAt": iso(r.requested_at),
        "reason": bilingual(r.reason),
        "requiredApprovals": r.required_approvals,
        "approvals": r.approvals or [],
        "status": r.status,
        "slaHoursRemaining": r.sla_hours_remaining,
    }


def audit_entry(a) -> dict:
    return {
        "id": a.id,
        "at": iso(a.at),
        "actor": a.actor,
        "actorKind": a.actor_kind,
        "action": a.action,
        "target": a.target,
        "detail": bilingual(a.detail),
        "outcome": a.outcome,
    }


def policy(p) -> dict:
    return {
        "id": p.id,
        "name": bilingual(p.name),
        "category": p.category,
        "enabled": p.enabled,
        "statement": bilingual(p.statement),
        "expression": p.expression,
        "enforcement": p.enforcement,
        "violations": p.violations,
        "updatedAt": iso(p.updated_at),
    }


def team_member(t) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "email": t.email,
        "role": t.role,
        "status": t.status,
        "lastActive": iso(t.last_active),
        "reviewsCompleted": t.reviews_completed,
    }


def integration(i) -> dict:
    return {
        "id": i.id,
        "name": i.name,
        "category": i.category,
        "connected": i.connected,
        "detail": i.detail,
        "scopes": i.scopes or [],
        "connectedAt": iso(i.connected_at),
    }


def pattern(p) -> dict:
    return {
        "id": p.id,
        "name": bilingual(p.name),
        "statement": bilingual(p.statement),
        "observations": p.observations,
        "confirmations": p.confirmations,
        "windowDays": p.window_days,
        "firstSeen": iso(p.first_seen),
        "lastMatched": iso(p.last_matched),
        "category": p.category,
        "citedBy": p.cited_by or [],
    }


def incident(i) -> dict:
    return {
        "id": i.id,
        "title": bilingual(i.title),
        "date": iso(i.date),
        "repo": i.repo,
        "rootCause": bilingual(i.root_cause),
        "recoveryHours": i.recovery_hours,
        "patternId": i.pattern_id,
    }


def trend_point(t) -> dict:
    return {
        "date": t.date,
        "label": t.label,
        "passed": t.passed,
        "failed": t.failed,
        "riskScore": t.risk_score,
        "findingsOpened": t.findings_opened,
        "findingsResolved": t.findings_resolved,
        "autoFixed": t.auto_fixed,
        "flagged": t.flagged,
        "refused": t.refused,
        "mttrHours": t.mttr_hours,
        "annotation": bilingual(t.annotation) if t.annotation else None,
    }


def agent_activity(a) -> dict:
    return {
        "id": a.id,
        "at": iso(a.at),
        "decision": a.decision,
        "title": bilingual(a.title),
        "repo": a.repo,
        "confidence": a.confidence,
        "investigationId": a.investigation_id,
        "durationMs": a.duration_ms,
    }


def dependency_graph(g) -> dict:
    return {
        "pipelineId": g.pipeline_id,
        "nodes": g.nodes or [],
        "edges": g.edges or [],
    }


def recorded_run(c) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "recordedAt": iso(c.recorded_at),
        "durationMs": c.duration_ms,
        "investigationIds": c.investigation_ids or [],
        "responseCount": c.response_count,
        "gatewayVersion": c.gateway_version,
        "checksum": c.checksum,
    }
