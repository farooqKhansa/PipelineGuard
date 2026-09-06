"""
Deterministic seed data for PipelineGuard.

Not a byte-for-byte port of the frontend's TypeScript mock fixtures
(src/lib/mock/*.ts) -- this generates its own cross-referenced dataset in the
same *shape* the dashboard contract requires (src/lib/types.ts), which is
what actually matters for the frontend to render correctly. Running this
script twice against an empty DB produces the same data every time (no
randomness), which is what "deterministic" means here.
"""
from datetime import datetime, timedelta, timezone

from app.database import Base, SessionLocal, engine
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
    Organization,
    Pipeline,
    PipelineJob,
    PipelineRun,
    Policy,
    RecordedRun,
    Repository,
    ReviewItem,
    TeamMember,
    TrendPoint,
    User,
    AgentActivity,
)

NOW = datetime(2026, 9, 3, 9, 0, 0, tzinfo=timezone.utc)


def bi(en: str, ur: str = "") -> dict:
    return {"en": en, "ur": ur or en}


def days_ago(n: int, hours: int = 0) -> datetime:
    return NOW - timedelta(days=n, hours=hours)


def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Organization).count() > 0:
            print("Seed data already present -- skipping. Delete the DB file to reseed.")
            return

        org = Organization(name="PipelineGuard Demo Org", slug="pipelineguard-demo")
        db.add(org)
        db.flush()

        users = [
            User(organization_id=org.id, name="Ayesha Khan", email="ayesha@pipelineguard.dev", role="owner", reviews_completed=14),
            User(organization_id=org.id, name="Bilal Ahmed", email="bilal@pipelineguard.dev", role="security", reviews_completed=9),
            User(organization_id=org.id, name="Sara Malik", email="sara@pipelineguard.dev", role="engineer", reviews_completed=3),
        ]
        db.add_all(users)

        team = [
            TeamMember(name="Ayesha Khan", email="ayesha@pipelineguard.dev", role="owner", status="active", last_active=days_ago(0), reviews_completed=14),
            TeamMember(name="Bilal Ahmed", email="bilal@pipelineguard.dev", role="security", status="active", last_active=days_ago(0, 2), reviews_completed=9),
            TeamMember(name="Sara Malik", email="sara@pipelineguard.dev", role="engineer", status="active", last_active=days_ago(1), reviews_completed=3),
            TeamMember(name="Usman Tariq", email="usman@pipelineguard.dev", role="viewer", status="invited", last_active=days_ago(6), reviews_completed=0),
        ]
        db.add_all(team)

        # --- Repositories ---
        repo_defs = [
            ("checkout-service", "acme-corp/checkout-service", "TypeScript", True, 91),
            ("payments-gateway", "acme-corp/payments-gateway", "Go", True, 74),
            ("infra-terraform", "acme-corp/infra-terraform", "HCL", True, 66),
            ("marketing-site", "acme-corp/marketing-site", "TypeScript", False, 97),
            ("mobile-app", "acme-corp/mobile-app", "Swift", True, 88),
        ]
        repos = {}
        for name, full_name, lang, private, health in repo_defs:
            r = Repository(
                organization_id=org.id,
                name=name,
                full_name=full_name,
                provider="github",
                default_branch="main",
                private=private,
                language=lang,
                health_score=health,
                last_activity=days_ago(0, 3),
                monitored=True,
            )
            db.add(r)
            repos[name] = r
        db.flush()

        # --- Pipelines + jobs + graphs ---
        pipeline_defs = [
            ("checkout-service", "deploy-prod", ".github/workflows/deploy-prod.yml", True, ["production"], ["PROD_DEPLOY_KEY", "STRIPE_SECRET"]),
            ("checkout-service", "ci", ".github/workflows/ci.yml", False, ["staging"], ["NPM_TOKEN"]),
            ("payments-gateway", "release", ".github/workflows/release.yml", True, ["production"], ["PROD_DEPLOY_KEY", "GPG_KEY"]),
            ("infra-terraform", "terraform-apply", ".github/workflows/terraform-apply.yml", True, ["production", "staging"], ["AWS_ROLE_ARN"]),
            ("mobile-app", "build-ios", ".github/workflows/build-ios.yml", False, ["testflight"], ["APPLE_CERT"]),
        ]
        pipelines = {}
        for repo_name, pname, path, prod, envs, secrets in pipeline_defs:
            p = Pipeline(
                repository_id=repos[repo_name].id,
                name=pname,
                provider="github_actions",
                file_path=path,
                touches_production=prod,
                environments=envs,
                secrets_used=secrets,
                pass_rate=0.94 if not prod else 0.86,
                last_run=days_ago(0, 4),
                health_score=90 if not prod else 70,
            )
            db.add(p)
            pipelines[pname] = p
        db.flush()

        finding_id_by_job: dict[str, list[str]] = {}
        for pname, p in pipelines.items():
            jobs = [
                PipelineJob(
                    pipeline_id=p.id, name="test", needs=[], permissions={"contents": "read"},
                    secrets=[], environment=None, steps=6, avg_duration_ms=42000, finding_ids=[],
                ),
                PipelineJob(
                    pipeline_id=p.id, name="build", needs=["test"], permissions={"contents": "read"},
                    secrets=[], environment=None, steps=4, avg_duration_ms=58000, finding_ids=[],
                ),
                PipelineJob(
                    pipeline_id=p.id, name="deploy", needs=["build"],
                    permissions={"contents": "read", "deployments": "write"} if not p.touches_production
                    else {"contents": "read", "deployments": "write", "id-token": "write"},
                    secrets=p.secrets_used, environment=p.environments[0] if p.environments else None,
                    steps=3, avg_duration_ms=71000, finding_ids=[],
                ),
            ]
            db.add_all(jobs)
            db.flush()

            nodes = [
                {"id": f"{p.id}-test", "label": "test", "kind": "job", "production": False, "findingIds": [], "column": 0, "row": 0},
                {"id": f"{p.id}-build", "label": "build", "kind": "job", "production": False, "findingIds": [], "column": 1, "row": 0},
                {"id": f"{p.id}-deploy", "label": "deploy", "kind": "job", "production": p.touches_production, "findingIds": [], "column": 2, "row": 0},
            ]
            edges = [
                {"from": f"{p.id}-test", "to": f"{p.id}-build", "kind": "needs", "tainted": False},
                {"from": f"{p.id}-build", "to": f"{p.id}-deploy", "kind": "needs", "tainted": p.touches_production},
            ]
            for i, secret in enumerate(p.secrets_used):
                sid = f"{p.id}-secret-{i}"
                nodes.append({"id": sid, "label": secret, "kind": "secret", "production": p.touches_production, "findingIds": [], "column": 2, "row": i + 1})
                edges.append({"from": f"{p.id}-deploy", "to": sid, "kind": "reads_secret", "tainted": p.touches_production})
            db.add(DependencyGraphModel(pipeline_id=p.id, nodes=nodes, edges=edges))

        db.flush()

        # --- Findings, investigations, fixes (cross-referenced) ---
        finding_defs = [
            # (repo, pipeline, severity, status, category, title, decision, forced_confidence)
            ("checkout-service", "deploy-prod", "critical", "in_review", "permissions",
             "Workflow permissions widened to write-all", "flagged", 68),
            ("payments-gateway", "release", "critical", "open", "supply_chain",
             "Third-party action pinned to mutable tag", "refused", 42),
            ("infra-terraform", "terraform-apply", "high", "fixed", "secrets",
             "AWS role assumed without environment gate", "auto_fixed", 96),
            ("checkout-service", "ci", "medium", "open", "integrity",
             "Build cache key derived from unsanitised branch name", "flagged", 58),
            ("mobile-app", "build-ios", "low", "accepted_risk", "policy",
             "Certificate secret exposed to fork PR context", "refused", 39),
            ("payments-gateway", "release", "medium", "fixed", "exposure",
             "Debug logging left enabled on production deploy job", "auto_fixed", 91),
        ]

        for i, (repo_name, pname, severity, status, category, title_en, decision, confidence) in enumerate(finding_defs):
            repo = repos[repo_name]
            pipeline = pipelines[pname]

            finding = Finding(
                repository_id=repo.id,
                pipeline_id=pipeline.id,
                rule_id=f"PG-{100 + i}",
                title=bi(title_en),
                description=bi(f"{title_en}. Detected in {pipeline.file_path} on {repo.full_name}."),
                severity=severity,
                status=status,
                file_path=pipeline.file_path,
                line=12 + i * 4,
                detected_at=days_ago(6 - i, i),
                resolved_at=days_ago(0, i) if status == "fixed" else None,
                impact=bi("Could allow a compromised job to reach production credentials." if severity in ("critical", "high") else "Low blast radius; contained to a non-production job."),
                category=category,
                cwe="CWE-269" if category == "permissions" else "CWE-829" if category == "supply_chain" else None,
            )
            db.add(finding)
            db.flush()

            steps = [
                {
                    "id": f"{finding.id}-s1", "kind": "detect",
                    "title": bi("Parsed workflow permissions block"),
                    "claim": bi(f"{title_en}."),
                    "because": [bi("Static analysis of the workflow YAML found the change in the same commit as an unrelated fix.")],
                    "citations": [{"label": pipeline.file_path, "href": None, "kind": "file"}],
                    "confidenceAfter": min(100, confidence - 20), "confidenceDelta": confidence - 20, "durationMs": 340,
                },
                {
                    "id": f"{finding.id}-s2", "kind": "historical",
                    "title": bi("Checked pattern history"),
                    "claim": bi("Similar changes in this repository were reverted within 48 hours in prior incidents."),
                    "because": [bi("Matched learned pattern LP-02.")],
                    "citations": [{"label": "LP-02", "href": None, "kind": "policy"}],
                    "confidenceAfter": confidence, "confidenceDelta": 20, "durationMs": 210,
                },
                {
                    "id": f"{finding.id}-s3", "kind": "decision",
                    "title": bi("Reached decision"),
                    "claim": bi(f"Decision: {decision}."),
                    "because": [bi("Confidence threshold compared against policy floors.")],
                    "citations": [], "confidenceAfter": confidence, "confidenceDelta": 0, "durationMs": 40,
                },
            ]

            investigation = Investigation(
                finding_id=finding.id,
                title=bi(title_en),
                repo=repo.full_name,
                pipeline=pipeline.name,
                pipeline_id=pipeline.id,
                run_id="",
                commit=f"{(i + 1) * 111111:06x}"[:7],
                commit_message=f"fix: adjust {pipeline.name} configuration",
                author=["ayesha", "bilal", "sara"][i % 3] + "@acme-corp",
                branch="main",
                file_path=pipeline.file_path,
                severity=severity,
                decision=decision,
                confidence=confidence,
                started_at=days_ago(6 - i, i),
                duration_ms=1200 + i * 300,
                steps=steps,
                gaps=[] if decision != "refused" else [
                    {
                        "missing": bi("Whether the permission widening was intentional or a copy-paste artifact."),
                        "wouldResolve": bi("A commit message or linked ticket explaining the change."),
                        "obtainableByAgent": False,
                    }
                ],
                hypotheses=[] if decision != "refused" else [
                    {"label": bi("Intentional widening for a new deploy step"), "probability": 0.52, "supports": [bi("New step added in the same diff.")], "contradicts": [bi("No corresponding step references the new permission.")]},
                    {"label": bi("Copy-paste from an unrelated template"), "probability": 0.48, "supports": [bi("Identical block seen in a public template repo.")], "contradicts": [bi("Template repo is not a known dependency.")]},
                ],
                thresholds={"autoFixFloor": 90, "recommendFloor": 60},
                similar_changes=[
                    {
                        "id": f"sim-{finding.id}", "repo": repo.full_name, "commit": "9c2a1de",
                        "summary": bi("Permission widening later reverted after a security review."),
                        "daysAgo": 41, "outcome": "reverted", "similarity": 0.81,
                    }
                ],
            )
            db.add(investigation)
            db.flush()

            finding.investigation_id = investigation.id

            fix = None
            if decision in ("auto_fixed", "flagged"):
                fix = Fix(
                    investigation_id=investigation.id,
                    title=bi(f"Restrict scope for {pipeline.name}"),
                    file_path=pipeline.file_path,
                    hunks=[
                        {
                            "header": "@@ -8,7 +8,7 @@ permissions:",
                            "lines": [
                                {"type": "context", "oldLine": 8, "newLine": 8, "content": "permissions:"},
                                {"type": "remove", "oldLine": 9, "newLine": None, "content": "  contents: write-all"},
                                {"type": "add", "oldLine": None, "newLine": 9, "content": "  contents: read"},
                                {"type": "context", "oldLine": 10, "newLine": 10, "content": "  deployments: write"},
                            ],
                        }
                    ],
                    prevents=bi("Prevents a compromised job step from writing to arbitrary repository contents."),
                    rationale=bi("The job only reads repository contents; write-all was broader than any step requires."),
                    validation={
                        "verified": decision == "auto_fixed",
                        "checks": [
                            {"name": "dry-run replay", "status": "passed" if decision == "auto_fixed" else "skipped", "detail": bi("Replayed against the last 5 runs of this workflow."), "durationMs": 900},
                        ],
                        "method": bi("Replayed the workflow against recent run history with the narrowed permission set."),
                    },
                    status="applied" if decision == "auto_fixed" else "awaiting_review",
                    pull_request={
                        "number": 400 + i, "title": f"pipelineguard: restrict permissions in {pipeline.name}",
                        "branch": f"pipelineguard/fix-{finding.id}", "baseBranch": "main",
                        "body": bi("Automated fix generated by PipelineGuard."),
                        "reviewers": ["bilal@acme-corp"], "state": "open" if decision == "flagged" else "merged",
                        "additions": 2, "deletions": 2, "filesChanged": 1,
                    } if decision == "auto_fixed" or i % 2 == 0 else None,
                )
                db.add(fix)
                db.flush()
                investigation.fix_id = fix.id

            if decision == "flagged" and fix:
                db.add(
                    ReviewItem(
                        fix_id=fix.id,
                        investigation_id=investigation.id,
                        title=bi(f"Review: {title_en}"),
                        repo=repo.full_name,
                        severity=severity,
                        requested_at=days_ago(5 - i, i),
                        reason=bi("Confidence below the auto-fix floor; a human should confirm intent before merge."),
                        required_approvals=1,
                        approvals=[],
                        status="pending",
                        sla_hours_remaining=max(2.0, 24 - i * 3),
                    )
                )

            db.add(
                Alert(
                    title=bi(title_en),
                    severity=severity,
                    kind="security" if category in ("permissions", "secrets", "supply_chain") else "pipeline",
                    repo=repo.full_name,
                    created_at=days_ago(6 - i, i),
                    read=status in ("fixed", "accepted_risk"),
                    investigation_id=investigation.id,
                    finding_id=finding.id,
                    body=bi(f"{title_en}. Severity: {severity}. Decision: {decision}."),
                )
            )

            db.add(
                AuditEntry(
                    at=days_ago(6 - i, i),
                    actor="pipelineguard-agent",
                    actor_kind="agent",
                    action=f"decision:{decision}",
                    target=f"{repo.full_name}#{finding.id}",
                    detail=bi(f"{title_en} -> {decision} (confidence {confidence})."),
                    outcome="refused" if decision == "refused" else "success",
                )
            )

            db.add(
                AgentActivity(
                    at=days_ago(6 - i, i),
                    decision=decision,
                    title=bi(title_en),
                    repo=repo.full_name,
                    confidence=confidence,
                    investigation_id=investigation.id,
                    duration_ms=1200 + i * 300,
                )
            )

        # --- Runs ---
        run_no = 1
        for pname, p in pipelines.items():
            for k in range(4):
                status = ["passed", "passed", "failed", "passed"][k % 4]
                db.add(
                    PipelineRun(
                        pipeline_id=p.id,
                        number=run_no,
                        status=status,
                        branch="main",
                        commit=f"{(run_no * 7919) % 0xFFFFFF:06x}",
                        commit_message="ci: routine build" if status == "passed" else "fix: address failing step",
                        author="ayesha@acme-corp",
                        started_at=days_ago(4 - k, k),
                        duration_ms=180000 + k * 5000,
                        risk_score=20 + (run_no * 13) % 60,
                        finding_ids=[],
                        decisions=[],
                        source="seed",
                    )
                )
                run_no += 1

        # --- Policies ---
        policies = [
            ("permissions", "Deny workflow-level write-all permissions", "workflow.permissions.contents != 'write-all'", "block", 3),
            ("secrets", "Secrets must be scoped to an environment", "job.secrets.subset_of(job.environment.secrets)", "warn", 5),
            ("supply_chain", "Third-party actions must be pinned to a commit SHA", "action.ref matches /^[0-9a-f]{40}$/", "block", 8),
            ("auto_fix", "Auto-fix requires confidence >= 90", "agent.confidence >= 90", "audit", 0),
            ("review", "Production-touching fixes require one approval", "pipeline.touchesProduction implies review.requiredApprovals >= 1", "block", 2),
        ]
        for category, statement_en, expr, enforcement, violations in policies:
            db.add(
                Policy(
                    name=bi(statement_en.split(" ")[0] + " policy"),
                    category=category,
                    enabled=True,
                    statement=bi(statement_en),
                    expression=expr,
                    enforcement=enforcement,
                    violations=violations,
                    updated_at=days_ago(10),
                )
            )

        # --- Integrations ---
        for name, category, connected, detail, scopes in [
            ("GitHub", "scm", True, "Connected via GitHub App installation.", ["actions:read", "pull_requests:write"]),
            ("GitHub Actions", "ci", True, "Reading workflow runs across 5 repositories.", ["actions:read"]),
            ("Alibaba Cloud", "cloud", False, "Not yet connected.", []),
            ("Slack", "notify", True, "Posting alerts to #pipeline-security.", ["chat:write"]),
        ]:
            db.add(Integration(name=name, category=category, connected=connected, detail=detail, scopes=scopes, connected_at=days_ago(30) if connected else None))

        # --- Patterns / incidents ---
        pattern1 = LearnedPattern(
            id="LP-02", name=bi("Permission widening precedes incidents"),
            statement=bi("When a permissions block is widened in the same commit that fixes a failing step, the widening is almost never necessary."),
            observations=4, confirmations=4, window_days=365,
            first_seen=days_ago(300), last_matched=days_ago(1), category="permissions", cited_by=[],
        )
        pattern2 = LearnedPattern(
            id="LP-07", name=bi("Tag-pinned actions drift silently"),
            statement=bi("Third-party actions referenced by tag resolve to different code within 90 days without a build failure."),
            observations=6, confirmations=5, window_days=180,
            first_seen=days_ago(150), last_matched=days_ago(3), category="supply_chain", cited_by=[],
        )
        db.add_all([pattern1, pattern2])
        db.add(
            HistoricalIncident(
                title=bi("Production secret exfiltrated via widened workflow permissions"),
                date=days_ago(120), repo="acme-corp/checkout-service",
                root_cause=bi("A workflow permission block was widened to write-all to unblock a failing deploy step."),
                recovery_hours=6.5, pattern_id="LP-02",
            )
        )

        # --- Trends (last 14 days) ---
        for d in range(13, -1, -1):
            date = days_ago(d)
            db.add(
                TrendPoint(
                    date=date.strftime("%Y-%m-%d"),
                    label=date.strftime("%d %b"),
                    passed=18 + (d % 5),
                    failed=2 + (d % 3),
                    risk_score=max(20, 60 - d * 2),
                    findings_opened=1 + (d % 3),
                    findings_resolved=1 + (d % 2),
                    auto_fixed=1 if d % 3 == 0 else 0,
                    flagged=1 if d % 2 == 0 else 0,
                    refused=1 if d % 5 == 0 else 0,
                    mttr_hours=round(max(2.0, 18 - d * 0.8), 1),
                    annotation=bi("Rolled out stricter permission policy.") if d == 8 else None,
                )
            )

        # --- Replay cassette ---
        db.add(
            RecordedRun(
                name="Hackathon demo run",
                recorded_at=days_ago(1),
                duration_ms=42000,
                investigation_ids=[],
                response_count=28,
                gateway_version="gw-0.4.2",
                checksum="sha256:deterministic-demo-checksum",
            )
        )

        db.commit()
        print("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
