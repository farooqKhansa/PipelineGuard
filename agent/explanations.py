"""Deterministic English and Roman Urdu explanations for agent outcomes."""

from dataclasses import dataclass
from typing import Any, Mapping

from agent.decision import (
    AUTO_FIX,
    ESCALATE_TO_HUMAN,
    PROPOSE_WITH_CAUTION,
)


@dataclass(frozen=True)
class ExplanationResult:
    """Dashboard-ready explanation and concise factual audit information."""

    action: str
    english: str
    roman_urdu: str
    reasoning: tuple[str, ...]
    review_items: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "action": self.action,
            "english": self.english,
            "roman_urdu": self.roman_urdu,
            "reasoning": list(self.reasoning),
            "review_items": list(self.review_items),
        }


def _get(value: Any, key: str, default: Any = None) -> Any:
    if isinstance(value, Mapping):
        return value.get(key, default)
    return getattr(value, key, default)


def _items(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value] if value.strip() else []
    if isinstance(value, (list, tuple)):
        return [str(item).strip() for item in value if str(item).strip()]
    return []


def _assessment_facts(assessment: Any) -> tuple[str, list[str]]:
    reasons = _items(_get(assessment, "reasons"))
    description = _get(assessment, "description")
    title = _get(assessment, "title")
    issue = description or title or (reasons[0] if reasons else None)
    if issue:
        issue = str(issue).strip().rstrip(".!?")
        evidence = " ".join(reasons).lower()
        if (
            not description
            and not title
            and "security-tests" in evidence
            and "security test gate" in evidence
            and ("removed" in evidence or "missing" in evidence)
        ):
            issue = "the security-tests gate was removed from the workflow"
        return issue, reasons
    return (
        "A security regression was reported, but its specific details were not provided.",
        reasons,
    )


def _roman_issue_summary(issue: str, reasons: list[str]) -> str:
    evidence = " ".join(reasons).lower()
    if (
        "security-tests" in evidence
        and "security test gate" in evidence
        and ("removed" in evidence or "missing" in evidence)
    ):
        return "Workflow se security-tests security test gate remove hone ki wajah se security regression detect hui"
    if issue.lower() == "a workflow change needs review":
        return "Assessment mein ek workflow change review ke liye report hui hai"
    return f"Assessment mein yeh issue report hua: {issue}"


def _confidence_text(confidence: Any) -> str | None:
    if isinstance(confidence, (int, float)) and not isinstance(confidence, bool):
        return f"{confidence:.2f} ({confidence:.0%})"
    return None


def _fix_summary(fix: Any) -> tuple[str, str]:
    if fix is None:
        return (
            "No generated fix was provided, so no applied change can be described.",
            "Koi generated fix provide nahi ki gayi, is liye applied change describe nahi ki ja sakti.",
        )

    fixed_workflow = str(_get(fix, "fixed_workflow", "") or "")
    unified_diff = str(_get(fix, "unified_diff", "") or "")
    if "security-tests:" in fixed_workflow and "security-tests:" not in str(
        _get(fix, "original_workflow", "") or ""
    ):
        return (
            "PipelineGuard generated a fix that restores the security-tests job.",
            "PipelineGuard ne security-tests job restore karne ke liye fix generate ki hai.",
        )
    if unified_diff.strip():
        return (
            "A generated diff is available for developer review; the explanation does not infer any other change.",
            "Generated diff developer review ke liye available hai; explanation kisi aur change ka andaza nahi lagati.",
        )
    return (
        "A fix result was supplied, but it does not contain enough detail to describe a generated change.",
        "Fix result mila hai, lekin generated change describe karne ke liye kafi detail nahi hai.",
    )


def _verification_summary(verification: Any) -> tuple[str, str, list[str]]:
    if verification is None:
        return (
            "No verification result was provided, so verification status is unknown.",
            "Verification result provide nahi hua, is liye verification status unknown hai.",
            ["No verification result was provided."],
        )

    checks = _get(verification, "checks")
    if not checks:
        return (
            "No individual verification checks were supplied; this was not treated as passed.",
            "Koi individual verification check provide nahi ki gayi; isay passed nahi maana gaya.",
            ["No individual verification checks were supplied."],
        )

    english_checks: list[str] = []
    roman_checks: list[str] = []
    reasoning: list[str] = []
    for check in checks:
        name = str(_get(check, "name", "Unnamed check"))
        status = str(_get(check, "status", "unknown")).lower()
        message = str(_get(check, "message", "") or "").strip().rstrip(".")

        if status == "passed":
            english_checks.append(f"{name} passed.")
            roman_checks.append(f"{name} check pass ho gaya.")
        elif status == "failed":
            detail = f": {message}" if message else ""
            english_checks.append(f"{name} failed{detail}.")
            roman_checks.append(
                f"{name} check fail ho gaya"
                + (f" kyun ke {message}." if message else ".")
            )
        elif status == "skipped":
            detail = f" because {message}" if message else ""
            english_checks.append(f"{name} was skipped{detail}.")
            roman_checks.append(
                f"{name} check skip kiya gaya"
                + (f" kyun ke {message}." if message else ".")
            )
        else:
            detail = f" ({message})" if message else ""
            english_checks.append(
                f"{name} returned an unrecognized status, so it was not treated as passed{detail}."
            )
            roman_checks.append(
                f"{name} ka status samajh nahi aaya, is liye isay pass nahi maana gaya."
            )

        reasoning.append(f"Verification check '{name}' status: {status}.")

    overall_status = str(_get(verification, "status", "unknown")).lower()
    if overall_status == "passed_with_skips":
        english_overall = "Overall verification status is passed with skips."
        roman_overall = "Overall verification status passed with skips hai."
    elif overall_status in {"passed", "failed"}:
        english_overall = f"Overall verification status is {overall_status}."
        roman_overall = f"Overall verification status {overall_status} hai."
    else:
        english_overall = (
            "Overall verification status is unknown and was not treated as passed."
        )
        roman_overall = (
            "Overall verification status unknown hai aur isay passed nahi maana gaya."
        )

    return (
        " ".join(english_checks + [english_overall]),
        " ".join(roman_checks + [roman_overall]),
        reasoning,
    )


def _decision_facts(decision: Any) -> tuple[str, list[str]]:
    action = str(_get(decision, "action", "UNKNOWN"))
    confidence = _get(decision, "confidence")
    reason = _get(decision, "reason")
    reasoning = [f"Decision outcome: {action}."]
    confidence_text = _confidence_text(confidence)
    if confidence_text:
        reasoning.append(f"Decision confidence: {confidence_text}.")
    if reason:
        reasoning.append(f"Decision reason: {str(reason).strip()}")
    return action, reasoning


def _auto_fix_explanation(
    assessment: Any,
    decision: Any,
    fix: Any,
    verification: Any,
) -> tuple[str, str, list[str], list[str]]:
    issue, reasons = _assessment_facts(assessment)
    confidence = _confidence_text(_get(decision, "confidence"))
    remediation_risk = _get(assessment, "remediation_risk")
    unambiguous = _get(assessment, "remediation_unambiguous")
    change_english, change_urdu = _fix_summary(fix)
    verification_english, verification_urdu, verification_reasoning = (
        _verification_summary(verification)
    )

    confidence_english = (
        f"Workstream 1 reported confidence {confidence}."
        if confidence
        else "The decision result did not provide a confidence value."
    )
    confidence_urdu = (
        f"Workstream 1 ka confidence {confidence} tha."
        if confidence
        else "Decision result mein confidence value provide nahi ki gayi."
    )
    risk_english = (
        f"The remediation risk is classified as {remediation_risk}-risk."
        if remediation_risk
        else "The assessment did not provide a remediation-risk classification."
    )
    risk_urdu = (
        f"Remediation risk {remediation_risk}-risk classify ki gayi hai."
        if remediation_risk
        else "Assessment mein remediation risk classification provide nahi ki gayi."
    )
    clear_english = (
        "The remediation is explicitly marked unambiguous."
        if unambiguous is True
        else "The assessment did not explicitly confirm that the remediation is unambiguous."
    )
    clear_urdu = (
        "Remediation ko explicitly clear aur unambiguous bataya gaya hai."
        if unambiguous is True
        else "Assessment ne remediation ko explicitly clear ya unambiguous confirm nahi kiya."
    )

    english = (
        f"A security regression was detected: {issue}. "
        f"{confidence_english} {risk_english} {clear_english} "
        f"{change_english} {verification_english} "
        "Workflow execution is outside the checks reported here, so runtime behavior "
        "and production behavior are not established."
    )
    roman_urdu = (
        f"{_roman_issue_summary(issue, reasons)}. "
        f"{confidence_urdu} {risk_urdu} {clear_urdu} "
        f"{change_urdu} {verification_urdu} "
        "Workflow execution in checks ka hissa nahi thi, is liye runtime aur production "
        "behavior confirm nahi hua."
    )
    reasoning = [
        f"Detected issue: {issue}",
        confidence_english,
        risk_english,
        clear_english,
        *reasons[1:3],
        *verification_reasoning,
    ]
    review_items = [
        "Review the generated diff before merging.",
        "Confirm that the restored security-tests job matches the repository's intended security gate.",
        "Do not treat this result as evidence that the workflow or production behavior was executed.",
    ]
    return english, roman_urdu, reasoning, review_items


def _caution_explanation(
    assessment: Any,
    decision: Any,
    fix: Any,
    verification: Any,
) -> tuple[str, str, list[str], list[str]]:
    issue, reasons = _assessment_facts(assessment)
    confidence = _confidence_text(_get(decision, "confidence"))
    confidence_english = (
        f"Confidence is {confidence}."
        if confidence
        else "The decision result did not provide a confidence value."
    )
    confidence_urdu = (
        f"Confidence {confidence} hai."
        if confidence
        else "Decision result mein confidence value provide nahi ki gayi."
    )
    change_english, change_urdu = _fix_summary(fix)
    verification_english, verification_urdu, verification_reasoning = (
        _verification_summary(verification)
    )

    english = (
        f"The assessment reports: {issue}. {confidence_english} "
        "The remediation could have significant impact, and the change may be intentional. "
        f"{change_english} PipelineGuard did not automatically apply or merge it. "
        "This may be intentional — confirm before merging. "
        "Human confirmation is required before applying or merging it. "
        f"{verification_english}"
    )
    roman_urdu = (
        f"Assessment ke mutabiq: {_roman_issue_summary(issue, reasons)}. {confidence_urdu} "
        "Proposed remediation ka impact significant ho sakta hai aur yeh change jaan-boojh kar ki gayi ho sakti hai. "
        f"{change_urdu} PipelineGuard ne isay automatically apply ya merge nahi kiya. "
        "Yeh change intentional ho sakti hai — merge se pehle confirm karein. "
        f"{verification_urdu}"
    )
    reasoning = [
        f"Detected issue: {issue}",
        confidence_english,
        "The decision classifies remediation impact as significant or potentially intentional.",
        "Automatic application or merge was not performed.",
        *reasons[1:3],
        *verification_reasoning,
    ]
    review_items = [
        "Confirm whether this workflow change was intentional.",
        "Review the impact of the proposed change on legitimate pipeline behavior.",
        "Human confirmation is required before applying or merging the change.",
    ]
    return english, roman_urdu, reasoning, review_items


def _escalation_explanation(
    assessment: Any,
    decision: Any,
    verification: Any,
) -> tuple[str, str, list[str], list[str]]:
    issue, reasons = _assessment_facts(assessment)
    decision_reason = _get(decision, "reason")
    uncertainty = (
        str(decision_reason).strip()
        if decision_reason
        else "The assessment does not provide enough information to determine a safe remediation."
    )
    verification_english, verification_urdu, verification_reasoning = (
        _verification_summary(verification)
    )

    english = (
        f"The assessment reports: {issue}. "
        f"However, the situation is uncertain: {uncertainty} "
        "PipelineGuard could not safely determine the correct remediation, so automatic "
        "fixing was refused. A human reviewer should investigate the missing context, "
        "confirm the intended workflow behavior, and choose the remediation."
    )
    roman_urdu = (
        f"Assessment ke mutabiq: {_roman_issue_summary(issue, reasons)}. "
        f"Lekin situation uncertain hai: {uncertainty} "
        "PipelineGuard sahi remediation safely determine nahi kar saka, is liye automatic "
        "fix refuse ki gayi. Human reviewer missing context aur intended workflow behavior "
        "investigate karke remediation choose kare."
    )
    reasoning = [
        f"Reported issue: {issue}",
        f"Uncertainty: {uncertainty}",
        "Automatic fixing was refused.",
        *reasons[1:3],
        *verification_reasoning,
    ]
    review_items = [
        "Investigate the missing or conflicting workflow context.",
        "Confirm the intended behavior with a human security or pipeline reviewer.",
        "Choose a remediation only after the uncertainty is resolved.",
    ]
    if verification is not None:
        review_items.append("Review the reported verification results before taking action.")
    return english, roman_urdu, reasoning, review_items


def explain(
    assessment: Any = None,
    decision: Any = None,
    fix: Any = None,
    verification: Any = None,
) -> ExplanationResult:
    """Build a deterministic explanation from supplied structured results."""

    action, decision_reasoning = _decision_facts(decision)
    if action == AUTO_FIX:
        english, roman_urdu, reasoning, review_items = _auto_fix_explanation(
            assessment, decision, fix, verification
        )
    elif action == PROPOSE_WITH_CAUTION:
        english, roman_urdu, reasoning, review_items = _caution_explanation(
            assessment, decision, fix, verification
        )
    elif action == ESCALATE_TO_HUMAN:
        english, roman_urdu, reasoning, review_items = _escalation_explanation(
            assessment, decision, verification
        )
    else:
        english = (
            "No recognized decision outcome was provided. No remediation is described."
        )
        roman_urdu = (
            "Decision outcome samajh nahi aaya. Koi remediation describe nahi ki gayi."
        )
        reasoning = ["No recognized decision outcome was provided."]
        review_items = ["Obtain a valid deterministic decision result before taking action."]

    return ExplanationResult(
        action=action,
        english=english,
        roman_urdu=roman_urdu,
        reasoning=tuple(decision_reasoning + reasoning),
        review_items=tuple(review_items),
    )


generate_explanation = explain