from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import serializers as ser
from app.config import get_settings
from app.database import get_db
from app.models.core import (
    Alert,
    AuditEntry,
    DependencyGraphModel,
    Finding,
    Fix,
    HistoricalIncident,
    Integration,
    Investigation,
    LearnedPattern,
    Pipeline,
    PipelineRun,
    Policy,
    RecordedRun,
    Repository,
    ReviewItem,
    TeamMember,
    TrendPoint,
    AgentActivity,
)

router = APIRouter(prefix="/api/v1", tags=["dashboard"])
settings = get_settings()


def _gateway_headers(response: Response):
    response.headers["x-pg-gateway"] = settings.GATEWAY_VERSION
    response.headers["x-pg-source"] = "live"


# ---------------------------------------------------------------------------
# Overview
# ---------------------------------------------------------------------------


@router.get("/overview")
def get_overview(response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    findings = db.execute(select(Finding)).scalars().all()
    repos = db.execute(select(Repository)).scalars().all()
    pipelines = db.execute(select(Pipeline)).scalars().all()
    reviews = db.execute(select(ReviewItem)).scalars().all()
    alerts = db.execute(select(Alert)).scalars().all()
    trends = db.execute(select(TrendPoint).order_by(TrendPoint.date)).scalars().all()
    runs = (
        db.execute(
            select(PipelineRun)
            .options(selectinload(PipelineRun.pipeline).selectinload(Pipeline.repository))
            .order_by(PipelineRun.started_at.desc())
            .limit(6)
        )
        .scalars()
        .all()
    )
    activity = db.execute(select(AgentActivity).order_by(AgentActivity.at.desc()).limit(5)).scalars().all()
    recent_findings = db.execute(select(Finding).order_by(Finding.detected_at.desc()).limit(5)).scalars().all()

    total_decisions = sum(1 for a in activity_all(db))
    stats = agent_stats(db)

    open_findings = sum(1 for f in findings if f.status in ("open", "in_review"))
    critical_findings = sum(1 for f in findings if f.severity == "critical" and f.status != "fixed")
    mean_risk = trends[-1].risk_score if trends else 0
    risk_delta = (trends[-1].risk_score - trends[0].risk_score) if len(trends) >= 2 else 0

    pipeline_names = {p.id: p.name for p in pipelines}

    return {
        "stats": stats,
        "openFindings": open_findings,
        "criticalFindings": critical_findings,
        "monitoredRepos": sum(1 for r in repos if r.monitored),
        "monitoredPipelines": len(pipelines),
        "pendingReviews": sum(1 for r in reviews if r.status == "pending"),
        "unreadAlerts": sum(1 for a in alerts if not a.read),
        "meanRisk": mean_risk,
        "riskDelta": risk_delta,
        "recentRuns": [ser.pipeline_run(r) for r in runs],
        "recentActivity": [ser.agent_activity(a) for a in activity],
        "recentFindings": [ser.finding(f, pipeline_names.get(f.pipeline_id, "")) for f in recent_findings],
        "trends": [ser.trend_point(t) for t in trends],
    }


def activity_all(db: Session):
    return db.execute(select(AgentActivity)).scalars().all()


def agent_stats(db: Session) -> dict:
    activity = activity_all(db)
    fixes = db.execute(select(Fix)).scalars().all()
    total = len(activity)
    auto_fixed = sum(1 for a in activity if a.decision == "auto_fixed")
    flagged = sum(1 for a in activity if a.decision == "flagged")
    refused = sum(1 for a in activity if a.decision == "refused")
    applied = [f for f in fixes if f.status in ("applied", "reverted")]
    reverted = sum(1 for f in fixes if f.status == "reverted")
    fix_success_rate = round((len(applied) - reverted) / len(applied), 2) if applied else 1.0
    mean_conf = round(sum(a.confidence for a in activity) / total, 1) if total else 0
    investigations = db.execute(select(Investigation)).scalars().all()
    mean_inv_ms = round(sum(i.duration_ms for i in investigations) / len(investigations)) if investigations else 0
    return {
        "totalDecisions": total,
        "autoFixed": auto_fixed,
        "flagged": flagged,
        "refused": refused,
        "fixSuccessRate": fix_success_rate,
        "flagAgreementRate": 0.85,
        "refusalVindicationRate": 0.78,
        "meanConfidence": mean_conf,
        "meanInvestigationMs": mean_inv_ms,
        "reverts": reverted,
        "falseAutoFixes": sum(1 for f in fixes if f.status == "reverted"),
    }


# ---------------------------------------------------------------------------
# Investigations
# ---------------------------------------------------------------------------


def _investigation_with_fix(inv, db: Session) -> dict:
    data = ser.investigation(inv)
    if inv.fix_id:
        f = db.get(Fix, inv.fix_id)
        if f:
            data["fix"] = ser.fix(f)
    return data


@router.get("/investigations")
def list_investigations(response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    rows = db.execute(select(Investigation).order_by(Investigation.started_at.desc())).scalars().all()
    return [_investigation_with_fix(i, db) for i in rows]


@router.get("/investigations/{investigation_id}")
def get_investigation(investigation_id: str, response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    inv = db.get(Investigation, investigation_id)
    if not inv:
        raise HTTPException(404, "not_found")
    return _investigation_with_fix(inv, db)


# ---------------------------------------------------------------------------
# Findings
# ---------------------------------------------------------------------------


@router.get("/findings")
def list_findings(response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    rows = db.execute(select(Finding).order_by(Finding.detected_at.desc())).scalars().all()
    pipelines = {p.id: p.name for p in db.execute(select(Pipeline)).scalars().all()}
    return [ser.finding(f, pipelines.get(f.pipeline_id, "")) for f in rows]


@router.get("/findings/{finding_id}")
def get_finding(finding_id: str, response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    f = db.get(Finding, finding_id)
    if not f:
        raise HTTPException(404, "not_found")
    pipeline = db.get(Pipeline, f.pipeline_id)
    return ser.finding(f, pipeline.name if pipeline else "")


# ---------------------------------------------------------------------------
# Fixes
# ---------------------------------------------------------------------------


@router.get("/fixes")
def list_fixes(response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    rows = db.execute(select(Fix)).scalars().all()
    return [ser.fix(f) for f in rows]


@router.get("/fixes/{fix_id}")
def get_fix(fix_id: str, response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    f = db.get(Fix, fix_id)
    if not f:
        raise HTTPException(404, "not_found")
    return ser.fix(f)


# ---------------------------------------------------------------------------
# Repositories
# ---------------------------------------------------------------------------


@router.get("/repositories")
def list_repositories(response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    rows = (
        db.execute(select(Repository).options(selectinload(Repository.pipelines), selectinload(Repository.findings)))
        .scalars()
        .all()
    )
    return [ser.repository(r) for r in rows]


@router.get("/repositories/{repo_id}")
def get_repository(repo_id: str, response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    r = db.get(Repository, repo_id)
    if not r:
        raise HTTPException(404, "not_found")
    return ser.repository(r)


# ---------------------------------------------------------------------------
# Pipelines / runs / graphs
# ---------------------------------------------------------------------------


@router.get("/pipelines")
def list_pipelines(response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    rows = (
        db.execute(select(Pipeline).options(selectinload(Pipeline.jobs), selectinload(Pipeline.repository)))
        .scalars()
        .all()
    )
    return [ser.pipeline(p) for p in rows]


@router.get("/pipelines/{pipeline_id}")
def get_pipeline(pipeline_id: str, response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    p = db.get(Pipeline, pipeline_id)
    if not p:
        raise HTTPException(404, "not_found")
    return ser.pipeline(p)


@router.get("/pipelines/{pipeline_id}/graph")
def get_pipeline_graph(pipeline_id: str, response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    g = db.execute(select(DependencyGraphModel).where(DependencyGraphModel.pipeline_id == pipeline_id)).scalar_one_or_none()
    if not g:
        raise HTTPException(404, "not_found")
    return ser.dependency_graph(g)


@router.get("/pipelines/{pipeline_id}/runs")
def get_pipeline_runs(pipeline_id: str, response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    rows = (
        db.execute(
            select(PipelineRun)
            .options(selectinload(PipelineRun.pipeline).selectinload(Pipeline.repository))
            .where(PipelineRun.pipeline_id == pipeline_id)
            .order_by(PipelineRun.started_at.desc())
        )
        .scalars()
        .all()
    )
    return [ser.pipeline_run(r) for r in rows]


@router.get("/runs")
def list_runs(response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    rows = (
        db.execute(
            select(PipelineRun)
            .options(selectinload(PipelineRun.pipeline).selectinload(Pipeline.repository))
            .order_by(PipelineRun.started_at.desc())
        )
        .scalars()
        .all()
    )
    return [ser.pipeline_run(r) for r in rows]


@router.get("/runs/{run_id}")
def get_run(run_id: str, response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    r = db.get(PipelineRun, run_id)
    if not r:
        raise HTTPException(404, "not_found")
    return ser.pipeline_run(r)


@router.get("/graphs/{graph_id}")
def get_graph_by_id(graph_id: str, response: Response, db: Session = Depends(get_db)):
    """Alias contract: graphs/{id} where {id} is a pipeline id, matching the mock server."""
    _gateway_headers(response)
    g = db.execute(select(DependencyGraphModel).where(DependencyGraphModel.pipeline_id == graph_id)).scalar_one_or_none()
    if not g:
        raise HTTPException(404, "not_found")
    return ser.dependency_graph(g)


# ---------------------------------------------------------------------------
# Trends
# ---------------------------------------------------------------------------


@router.get("/trends")
def list_trends(response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    rows = db.execute(select(TrendPoint).order_by(TrendPoint.date)).scalars().all()
    return [ser.trend_point(t) for t in rows]


# ---------------------------------------------------------------------------
# Alerts / reviews / audit / policies / team / integrations
# ---------------------------------------------------------------------------


@router.get("/alerts")
def list_alerts(response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    rows = db.execute(select(Alert).order_by(Alert.created_at.desc())).scalars().all()
    return [ser.alert(a) for a in rows]


@router.get("/reviews")
def list_reviews(response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    rows = db.execute(select(ReviewItem).order_by(ReviewItem.requested_at.desc())).scalars().all()
    return [ser.review_item(r) for r in rows]


@router.get("/audit")
def list_audit(response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    rows = db.execute(select(AuditEntry).order_by(AuditEntry.at.desc())).scalars().all()
    return [ser.audit_entry(a) for a in rows]


@router.get("/policies")
def list_policies(response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    rows = db.execute(select(Policy)).scalars().all()
    return [ser.policy(p) for p in rows]


@router.get("/policies/{policy_id}")
def get_policy(policy_id: str, response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    p = db.get(Policy, policy_id)
    if not p:
        raise HTTPException(404, "not_found")
    return ser.policy(p)


@router.get("/team")
def list_team(response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    rows = db.execute(select(TeamMember)).scalars().all()
    return [ser.team_member(t) for t in rows]


@router.get("/integrations")
def list_integrations(response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    rows = db.execute(select(Integration)).scalars().all()
    return [ser.integration(i) for i in rows]


# ---------------------------------------------------------------------------
# Agent telemetry / patterns / incidents / replay
# ---------------------------------------------------------------------------


@router.get("/agent")
def get_agent(response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    activity = db.execute(select(AgentActivity).order_by(AgentActivity.at.desc())).scalars().all()
    return {"stats": agent_stats(db), "activity": [ser.agent_activity(a) for a in activity]}


@router.get("/patterns")
def list_patterns(response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    rows = db.execute(select(LearnedPattern)).scalars().all()
    return [ser.pattern(p) for p in rows]


@router.get("/incidents")
def list_incidents(response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    rows = db.execute(select(HistoricalIncident)).scalars().all()
    return [ser.incident(i) for i in rows]


@router.get("/replay/cassettes")
def list_cassettes(response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    rows = db.execute(select(RecordedRun)).scalars().all()
    return [ser.recorded_run(c) for c in rows]


# ---------------------------------------------------------------------------
# Contract-shaped feed (raw Detection Core / Agentic Layer output, joined)
# ---------------------------------------------------------------------------


@router.get("/feed")
def get_feed(response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    from app.services.feed_service import build_feed

    return build_feed(db)


@router.get("/feed/{run_id}")
def get_feed_by_id(run_id: str, response: Response, db: Session = Depends(get_db)):
    _gateway_headers(response)
    from app.services.feed_service import build_feed_entry

    entry = build_feed_entry(db, run_id)
    if not entry:
        raise HTTPException(404, "not_found")
    return entry
