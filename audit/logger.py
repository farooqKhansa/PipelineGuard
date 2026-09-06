"""Creation, serialization, and local persistence of audit records."""

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Mapping
from uuid import uuid4

from audit.schemas import AuditCheck, AuditRecord


def _get(value: Any, key: str, default: Any = None) -> Any:
    if isinstance(value, Mapping):
        return value.get(key, default)
    return getattr(value, key, default)


def _string_items(value: Any) -> tuple[str, ...]:
    if isinstance(value, str):
        return (value,) if value.strip() else ()
    if isinstance(value, (list, tuple)):
        return tuple(str(item).strip() for item in value if str(item).strip())
    return ()


def _verification_checks(verification: Any) -> tuple[AuditCheck, ...]:
    checks = _get(verification, "checks", ()) if verification is not None else ()
    if not checks:
        return ()

    result = []
    for check in checks:
        name = _get(check, "name")
        status = _get(check, "status")
        if name is None or status is None:
            continue
        message = _get(check, "message")
        result.append(
            AuditCheck(
                name=str(name),
                status=str(status),
                message=str(message) if message is not None else None,
            )
        )
    return tuple(result)


def _fix_details(fix: Any) -> tuple[bool, str | None]:
    if fix is None:
        return False, None

    explicit_generated = _get(fix, "fix_generated")
    diff = _get(fix, "unified_diff")
    if explicit_generated is not None:
        return bool(explicit_generated), str(diff) if diff else None

    if isinstance(diff, str) and diff.strip():
        return True, diff
    return False, None


def create_audit_record(
    assessment: Any = None,
    decision: Any = None,
    fix: Any = None,
    verification: Any = None,
    explanation: Any = None,
    gemini: Any = None,
    *,
    audit_id: str | None = None,
    timestamp: str | None = None,
) -> AuditRecord:
    """Create an audit record from observable pipeline results."""

    if audit_id is None:
        audit_id = f"audit-{uuid4().hex}"
    if timestamp is None:
        timestamp = datetime.now(timezone.utc).isoformat()

    issue = _get(assessment, "issue", {})
    issue_id = _get(assessment, "issue_id") or _get(issue, "id")
    repository = _get(assessment, "repo") or _get(assessment, "repository")
    workflow_run_id = _get(assessment, "workflow_run_id")

    decision_confidence = _get(decision, "confidence")
    confidence = (
        decision_confidence
        if decision_confidence is not None
        else _get(assessment, "confidence")
    )
    selected_action = _get(decision, "action") or _get(assessment, "action")
    remediation_risk = _get(assessment, "remediation_risk")
    remediation_unambiguous = _get(assessment, "remediation_unambiguous")
    fix_generated, fix_diff = _fix_details(fix)
    gemini_recommendation = _get(gemini, "recommendation")

    verification_status = (
        str(_get(verification, "status"))
        if verification is not None and _get(verification, "status") is not None
        else "unknown"
    )

    return AuditRecord(
        audit_id=audit_id,
        timestamp=timestamp,
        repository=str(repository) if repository is not None else None,
        workflow_run_id=(
            str(workflow_run_id) if workflow_run_id is not None else None
        ),
        issue_id=str(issue_id) if issue_id is not None else None,
        risk_score=_get(assessment, "risk_score"),
        confidence=confidence,
        selected_action=(
            str(selected_action) if selected_action is not None else None
        ),
        remediation_risk=(
            str(remediation_risk) if remediation_risk is not None else None
        ),
        remediation_unambiguous=remediation_unambiguous,
        fix_generated=fix_generated,
        fix_diff=fix_diff,
        verification_status=verification_status,
        verification_checks=_verification_checks(verification),
        english_explanation=_get(explanation, "english"),
        roman_urdu_explanation=_get(explanation, "roman_urdu"),
        reasoning=_string_items(_get(explanation, "reasoning")),
        review_items=_string_items(_get(explanation, "review_items")),
        deterministic_action=_get(gemini, "deterministic_action"),
        gemini_recommended_action=_get(
            gemini_recommendation,
            "recommended_action",
        ),
        gemini_confidence=_get(gemini_recommendation, "confidence"),
        gemini_rationale=_get(gemini_recommendation, "rationale"),
        gemini_uncertainty=_get(gemini_recommendation, "uncertainty"),
        gemini_requires_human_review=_get(
            gemini_recommendation,
            "requires_human_review",
        ),
        gemini_relationship=_get(gemini, "relationship"),
        gemini_status=_get(gemini, "status"),
        final_enforced_action=_get(gemini, "final_enforced_action"),
    )


def write_audit_record(
    record: AuditRecord,
    directory: str | Path = "audit_records",
) -> Path:
    """Write a record without overwriting an earlier record."""

    audit_directory = Path(directory)
    audit_directory.mkdir(parents=True, exist_ok=True)
    base_path = audit_directory / f"{record.audit_id}.json"
    attempt = 0

    while True:
        path = (
            base_path
            if attempt == 0
            else audit_directory / f"{record.audit_id}-{attempt}.json"
        )
        try:
            with path.open("x", encoding="utf-8") as audit_file:
                json.dump(
                    record.to_dict(),
                    audit_file,
                    indent=2,
                    ensure_ascii=False,
                )
                audit_file.write("\n")
            return path
        except FileExistsError:
            attempt += 1


class AuditLogger:
    """Small convenience wrapper around audit-record creation and storage."""

    def __init__(self, directory: str | Path = "audit_records"):
        self.directory = Path(directory)

    def create_record(self, *args: Any, **kwargs: Any) -> AuditRecord:
        return create_audit_record(*args, **kwargs)

    def write(self, record: AuditRecord) -> Path:
        return write_audit_record(record, self.directory)

    def log(self, *args: Any, **kwargs: Any) -> tuple[AuditRecord, Path]:
        record = self.create_record(*args, **kwargs)
        return record, self.write(record)