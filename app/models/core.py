"""
SQLAlchemy 2.x domain models for PipelineGuard.

Design note: the dashboard contract (frontend `src/lib/types.ts`) needs
richly nested, bilingual, UI-shaped JSON per entity (reasoning steps, diff
hunks, evidence gaps, etc.). Those nested substructures are stored as JSON
columns on the owning row rather than fully normalised into their own
tables -- they are never queried independently of their parent, only
displayed. The relationships that ARE queried independently (repo -> pipeline
-> run -> finding -> investigation -> fix, and audit/alerts/reviews by
repo/severity/status) are real foreign keys with indexes.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Tenancy
# ---------------------------------------------------------------------------


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("org"))
    name: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

    users: Mapped[list["User"]] = relationship(back_populates="organization")
    repositories: Mapped[list["Repository"]] = relationship(back_populates="organization")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("usr"))
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    role: Mapped[str] = mapped_column(String, default="engineer")
    status: Mapped[str] = mapped_column(String, default="active")
    last_active: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    reviews_completed: Mapped[int] = mapped_column(Integer, default=0)
    hashed_password: Mapped[str | None] = mapped_column(String, nullable=True)

    organization: Mapped["Organization"] = relationship(back_populates="users")


# ---------------------------------------------------------------------------
# Repositories / pipelines
# ---------------------------------------------------------------------------


class Repository(Base):
    __tablename__ = "repositories"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("repo"))
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    provider: Mapped[str] = mapped_column(String, default="github")
    default_branch: Mapped[str] = mapped_column(String, default="main")
    private: Mapped[bool] = mapped_column(Boolean, default=True)
    language: Mapped[str] = mapped_column(String, default="")
    health_score: Mapped[int] = mapped_column(Integer, default=100)
    last_activity: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    monitored: Mapped[bool] = mapped_column(Boolean, default=True)
    installation_id: Mapped[str | None] = mapped_column(String, nullable=True)

    organization: Mapped["Organization"] = relationship(back_populates="repositories")
    pipelines: Mapped[list["Pipeline"]] = relationship(back_populates="repository")
    findings: Mapped[list["Finding"]] = relationship(back_populates="repository")


class Pipeline(Base):
    __tablename__ = "pipelines"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("pl"))
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"), index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    provider: Mapped[str] = mapped_column(String, default="github_actions")
    file_path: Mapped[str] = mapped_column(String, nullable=False)
    touches_production: Mapped[bool] = mapped_column(Boolean, default=False)
    environments: Mapped[list] = mapped_column(JSON, default=list)
    secrets_used: Mapped[list] = mapped_column(JSON, default=list)
    pass_rate: Mapped[float] = mapped_column(Float, default=1.0)
    last_run: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    health_score: Mapped[int] = mapped_column(Integer, default=100)

    repository: Mapped["Repository"] = relationship(back_populates="pipelines")
    jobs: Mapped[list["PipelineJob"]] = relationship(back_populates="pipeline", cascade="all, delete-orphan")
    runs: Mapped[list["PipelineRun"]] = relationship(back_populates="pipeline", cascade="all, delete-orphan")
    graph: Mapped["DependencyGraphModel | None"] = relationship(back_populates="pipeline", uselist=False)


class PipelineJob(Base):
    __tablename__ = "pipeline_jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("job"))
    pipeline_id: Mapped[str] = mapped_column(ForeignKey("pipelines.id"), index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    needs: Mapped[list] = mapped_column(JSON, default=list)
    permissions: Mapped[dict] = mapped_column(JSON, default=dict)
    secrets: Mapped[list] = mapped_column(JSON, default=list)
    environment: Mapped[str | None] = mapped_column(String, nullable=True)
    steps: Mapped[int] = mapped_column(Integer, default=0)
    avg_duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    finding_ids: Mapped[list] = mapped_column(JSON, default=list)

    pipeline: Mapped["Pipeline"] = relationship(back_populates="jobs")


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("run"))
    pipeline_id: Mapped[str] = mapped_column(ForeignKey("pipelines.id"), index=True)
    number: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String, default="running", index=True)
    branch: Mapped[str] = mapped_column(String, default="main")
    commit: Mapped[str] = mapped_column(String, default="")
    commit_message: Mapped[str] = mapped_column(String, default="")
    author: Mapped[str] = mapped_column(String, default="")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    risk_score: Mapped[int] = mapped_column(Integer, default=0)
    finding_ids: Mapped[list] = mapped_column(JSON, default=list)
    decisions: Mapped[list] = mapped_column(JSON, default=list)

    # Orchestration bookkeeping (used by the webhook/agent flow; not part of
    # the dashboard contract but persisted for the trace endpoint).
    workflow_run_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    github_delivery_id: Mapped[str | None] = mapped_column(String, nullable=True, unique=True, index=True)
    source: Mapped[str] = mapped_column(String, default="seed")  # seed | webhook | demo

    pipeline: Mapped["Pipeline"] = relationship(back_populates="runs")
    trace_events: Mapped[list["RunTraceEvent"]] = relationship(back_populates="run", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Findings / investigations / fixes
# ---------------------------------------------------------------------------


class Finding(Base):
    __tablename__ = "findings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("fnd"))
    repository_id: Mapped[str] = mapped_column(ForeignKey("repositories.id"), index=True)
    pipeline_id: Mapped[str] = mapped_column(ForeignKey("pipelines.id"), index=True)
    rule_id: Mapped[str] = mapped_column(String, default="")
    title: Mapped[dict] = mapped_column(JSON, default=dict)  # Bilingual
    description: Mapped[dict] = mapped_column(JSON, default=dict)
    severity: Mapped[str] = mapped_column(String, index=True)
    status: Mapped[str] = mapped_column(String, default="open", index=True)
    file_path: Mapped[str] = mapped_column(String, default="")
    line: Mapped[int] = mapped_column(Integer, default=1)
    job_id: Mapped[str | None] = mapped_column(String, nullable=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    investigation_id: Mapped[str | None] = mapped_column(String, nullable=True)
    impact: Mapped[dict] = mapped_column(JSON, default=dict)
    category: Mapped[str] = mapped_column(String, default="policy")
    cwe: Mapped[str | None] = mapped_column(String, nullable=True)

    repository: Mapped["Repository"] = relationship(back_populates="findings")


class Investigation(Base):
    __tablename__ = "investigations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("inv"))
    finding_id: Mapped[str] = mapped_column(String, index=True)
    title: Mapped[dict] = mapped_column(JSON, default=dict)
    repo: Mapped[str] = mapped_column(String, default="")
    pipeline: Mapped[str] = mapped_column(String, default="")
    pipeline_id: Mapped[str] = mapped_column(String, default="")
    run_id: Mapped[str] = mapped_column(String, default="")
    commit: Mapped[str] = mapped_column(String, default="")
    commit_message: Mapped[str] = mapped_column(String, default="")
    author: Mapped[str] = mapped_column(String, default="")
    branch: Mapped[str] = mapped_column(String, default="")
    file_path: Mapped[str] = mapped_column(String, default="")
    severity: Mapped[str] = mapped_column(String, index=True)
    decision: Mapped[str] = mapped_column(String, index=True)  # auto_fixed | flagged | refused
    confidence: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    steps: Mapped[list] = mapped_column(JSON, default=list)
    fix_id: Mapped[str | None] = mapped_column(String, nullable=True)
    gaps: Mapped[list] = mapped_column(JSON, default=list)
    hypotheses: Mapped[list] = mapped_column(JSON, default=list)
    thresholds: Mapped[dict] = mapped_column(JSON, default=dict)
    similar_changes: Mapped[list] = mapped_column(JSON, default=list)


class Fix(Base):
    __tablename__ = "fixes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("fix"))
    investigation_id: Mapped[str] = mapped_column(String, index=True)
    title: Mapped[dict] = mapped_column(JSON, default=dict)
    file_path: Mapped[str] = mapped_column(String, default="")
    hunks: Mapped[list] = mapped_column(JSON, default=list)
    prevents: Mapped[dict] = mapped_column(JSON, default=dict)
    rationale: Mapped[dict] = mapped_column(JSON, default=dict)
    validation: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String, default="proposed", index=True)
    pull_request: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    revert_reason: Mapped[dict | None] = mapped_column(JSON, nullable=True)


# ---------------------------------------------------------------------------
# Alerts / reviews / audit / policy / team / integrations
# ---------------------------------------------------------------------------


class ReviewItem(Base):
    __tablename__ = "review_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("rev"))
    fix_id: Mapped[str] = mapped_column(String, index=True)
    investigation_id: Mapped[str] = mapped_column(String, index=True)
    title: Mapped[dict] = mapped_column(JSON, default=dict)
    repo: Mapped[str] = mapped_column(String, default="")
    severity: Mapped[str] = mapped_column(String, index=True)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    reason: Mapped[dict] = mapped_column(JSON, default=dict)
    required_approvals: Mapped[int] = mapped_column(Integer, default=1)
    approvals: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String, default="pending", index=True)
    sla_hours_remaining: Mapped[float] = mapped_column(Float, default=24.0)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("alt"))
    title: Mapped[dict] = mapped_column(JSON, default=dict)
    severity: Mapped[str] = mapped_column(String, index=True)
    kind: Mapped[str] = mapped_column(String, default="pipeline")
    repo: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    investigation_id: Mapped[str | None] = mapped_column(String, nullable=True)
    finding_id: Mapped[str | None] = mapped_column(String, nullable=True)
    body: Mapped[dict] = mapped_column(JSON, default=dict)


class AuditEntry(Base):
    __tablename__ = "audit_entries"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("aud"))
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    actor: Mapped[str] = mapped_column(String, default="system")
    actor_kind: Mapped[str] = mapped_column(String, default="system")
    action: Mapped[str] = mapped_column(String, default="")
    target: Mapped[str] = mapped_column(String, default="")
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
    outcome: Mapped[str] = mapped_column(String, default="success")


class Policy(Base):
    __tablename__ = "policies"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("pol"))
    name: Mapped[dict] = mapped_column(JSON, default=dict)
    category: Mapped[str] = mapped_column(String, default="permissions")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    statement: Mapped[dict] = mapped_column(JSON, default=dict)
    expression: Mapped[str] = mapped_column(Text, default="")
    enforcement: Mapped[str] = mapped_column(String, default="warn")
    violations: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class TeamMember(Base):
    __tablename__ = "team_members"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("tm"))
    name: Mapped[str] = mapped_column(String, default="")
    email: Mapped[str] = mapped_column(String, default="")
    role: Mapped[str] = mapped_column(String, default="engineer")
    status: Mapped[str] = mapped_column(String, default="active")
    last_active: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    reviews_completed: Mapped[int] = mapped_column(Integer, default=0)


class Integration(Base):
    __tablename__ = "integrations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("int"))
    name: Mapped[str] = mapped_column(String, default="")
    category: Mapped[str] = mapped_column(String, default="scm")
    connected: Mapped[bool] = mapped_column(Boolean, default=False)
    detail: Mapped[str] = mapped_column(String, default="")
    scopes: Mapped[list] = mapped_column(JSON, default=list)
    connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


# ---------------------------------------------------------------------------
# Learned patterns / incidents / trends / agent activity
# ---------------------------------------------------------------------------


class LearnedPattern(Base):
    __tablename__ = "learned_patterns"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("LP"))
    name: Mapped[dict] = mapped_column(JSON, default=dict)
    statement: Mapped[dict] = mapped_column(JSON, default=dict)
    observations: Mapped[int] = mapped_column(Integer, default=0)
    confirmations: Mapped[int] = mapped_column(Integer, default=0)
    window_days: Mapped[int] = mapped_column(Integer, default=90)
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    last_matched: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    category: Mapped[str] = mapped_column(String, default="permissions")
    cited_by: Mapped[list] = mapped_column(JSON, default=list)


class HistoricalIncident(Base):
    __tablename__ = "historical_incidents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("HI"))
    title: Mapped[dict] = mapped_column(JSON, default=dict)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    repo: Mapped[str] = mapped_column(String, default="")
    root_cause: Mapped[dict] = mapped_column(JSON, default=dict)
    recovery_hours: Mapped[float] = mapped_column(Float, default=1.0)
    pattern_id: Mapped[str | None] = mapped_column(String, nullable=True)


class TrendPoint(Base):
    __tablename__ = "trend_points"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("trd"))
    date: Mapped[str] = mapped_column(String, index=True)
    label: Mapped[str] = mapped_column(String, default="")
    passed: Mapped[int] = mapped_column(Integer, default=0)
    failed: Mapped[int] = mapped_column(Integer, default=0)
    risk_score: Mapped[int] = mapped_column(Integer, default=0)
    findings_opened: Mapped[int] = mapped_column(Integer, default=0)
    findings_resolved: Mapped[int] = mapped_column(Integer, default=0)
    auto_fixed: Mapped[int] = mapped_column(Integer, default=0)
    flagged: Mapped[int] = mapped_column(Integer, default=0)
    refused: Mapped[int] = mapped_column(Integer, default=0)
    mttr_hours: Mapped[float] = mapped_column(Float, default=0.0)
    annotation: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class AgentActivity(Base):
    __tablename__ = "agent_activity"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("act"))
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    decision: Mapped[str] = mapped_column(String, default="flagged")
    title: Mapped[dict] = mapped_column(JSON, default=dict)
    repo: Mapped[str] = mapped_column(String, default="")
    confidence: Mapped[int] = mapped_column(Integer, default=0)
    investigation_id: Mapped[str] = mapped_column(String, default="")
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)


class DependencyGraphModel(Base):
    __tablename__ = "dependency_graphs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("grf"))
    pipeline_id: Mapped[str] = mapped_column(ForeignKey("pipelines.id"), unique=True, index=True)
    nodes: Mapped[list] = mapped_column(JSON, default=list)
    edges: Mapped[list] = mapped_column(JSON, default=list)

    pipeline: Mapped["Pipeline"] = relationship(back_populates="graph")


class RecordedRun(Base):
    """Replay cassette metadata (`GET /replay/cassettes`)."""

    __tablename__ = "recorded_runs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("cas"))
    name: Mapped[str] = mapped_column(String, default="")
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    investigation_ids: Mapped[list] = mapped_column(JSON, default=list)
    response_count: Mapped[int] = mapped_column(Integer, default=0)
    gateway_version: Mapped[str] = mapped_column(String, default="gw-0.4.2")
    checksum: Mapped[str] = mapped_column(String, default="")


# ---------------------------------------------------------------------------
# Orchestration: webhook idempotency + run trace
# ---------------------------------------------------------------------------


class WebhookEvent(Base):
    """
    GitHub delivery IDs are recorded with a uniqueness constraint so a
    redelivered webhook never creates a duplicate PipelineRun / fix / PR.
    """

    __tablename__ = "webhook_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("wh"))
    delivery_id: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    event_type: Mapped[str] = mapped_column(String, default="")
    repo: Mapped[str] = mapped_column(String, default="")
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    run_id: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="received")

    __table_args__ = (UniqueConstraint("delivery_id", name="uq_webhook_delivery_id"),)


class RunTraceEvent(Base):
    """
    One row per lifecycle stage for a PipelineRun. `GET /runs/{id}/trace`
    assembles these in order. This is the backbone of the live demo.
    """

    __tablename__ = "run_trace_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: _id("tr"))
    run_id: Mapped[str] = mapped_column(ForeignKey("pipeline_runs.id"), index=True)
    stage: Mapped[str] = mapped_column(String, index=True)
    status: Mapped[str] = mapped_column(String, default="ok")  # ok | error | fallback
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    detail: Mapped[dict] = mapped_column(JSON, default=dict)

    run: Mapped["PipelineRun"] = relationship(back_populates="trace_events")

    __table_args__ = (Index("ix_trace_run_stage", "run_id", "stage"),)
