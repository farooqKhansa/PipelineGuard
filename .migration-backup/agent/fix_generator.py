"""Controlled local fix generation for the PipelineGuard AUTO_FIX path."""

from dataclasses import dataclass
import difflib
import re
from typing import Any, Mapping

from agent.decision import AUTO_FIX, decide


TARGET_JOB = "security-tests"


@dataclass(frozen=True)
class FixResult:
    """The generated workflow change, before any verification is performed."""

    original_workflow: str
    fixed_workflow: str
    unified_diff: str


class FixGenerationError(ValueError):
    """Raised when a safe, evidence-based fix cannot be generated."""


def _job_from_evidence(diff_text: str) -> str:
    """Extract the one deleted workflow job from the assessment diff."""

    removed_lines = []
    for line in diff_text.splitlines(keepends=True):
        if line.startswith("--- ") or line.startswith("+++ "):
            continue
        if line.startswith("-"):
            removed_lines.append(line[1:])

    non_blank_lines = [line for line in removed_lines if line.strip()]
    job_line_indexes = [
        index
        for index, line in enumerate(non_blank_lines)
        if line.strip() == f"{TARGET_JOB}:"
    ]

    if len(job_line_indexes) != 1:
        raise FixGenerationError(
            "The assessment diff does not identify exactly one deleted "
            f"{TARGET_JOB} job."
        )

    job_index = job_line_indexes[0]
    job_lines = non_blank_lines[job_index:]
    job_indent = len(job_lines[0]) - len(job_lines[0].lstrip())

    if any(
        len(line) - len(line.lstrip()) <= job_indent
        for line in job_lines[1:]
    ):
        raise FixGenerationError(
            "The assessment diff includes deleted workflow content outside "
            f"the {TARGET_JOB} job."
        )

    job_text = "".join(job_lines).rstrip()
    required_fragments = (
        f"{TARGET_JOB}:",
        "needs: test",
        "runs-on: ubuntu-latest",
        "name: Run security tests",
        "run: ./scripts/security-tests.sh",
    )
    if any(fragment not in job_text for fragment in required_fragments):
        raise FixGenerationError(
            f"The assessment does not provide enough evidence to restore "
            f"{TARGET_JOB} safely."
        )

    return job_text


def _insert_before_deploy(workflow_content: str, job_text: str) -> str:
    """Insert the evidence-derived job immediately before the deploy job."""

    lines = workflow_content.splitlines(keepends=True)
    deploy_indexes = [
        index
        for index, line in enumerate(lines)
        if re.match(r"^[ \t]+deploy\s*:\s*(?:#.*)?\s*$", line.rstrip("\r\n"))
    ]

    if len(deploy_indexes) != 1:
        raise FixGenerationError(
            "The workflow must contain exactly one deploy job as the insertion point."
        )

    deploy_index = deploy_indexes[0]
    newline = "\r\n" if "\r\n" in workflow_content else "\n"
    job_text = job_text.replace("\r\n", "\n").replace("\n", newline)

    prefix = "".join(lines[:deploy_index])
    suffix = "".join(lines[deploy_index:])
    if prefix and not prefix.endswith(("\n", "\r")):
        prefix += newline
    if not prefix.endswith(newline + newline):
        prefix += newline

    return prefix + job_text + newline + newline + suffix


def generate_fix(
    workflow_content: str, assessment: Mapping[str, Any]
) -> FixResult:
    """Generate the narrowly scoped security-gate restoration.

    The decision engine is the eligibility gate. This function only performs
    the specific restoration evidenced by the assessment diff; it does not
    parse, lint, simulate, or claim to verify YAML.
    """

    if not isinstance(workflow_content, str) or not workflow_content.strip():
        raise FixGenerationError("Required workflow content is missing.")

    decision = decide(assessment)
    if decision.action != AUTO_FIX:
        raise FixGenerationError(
            f"Fix generation refused because the assessment is not AUTO_FIX "
            f"eligible: {decision.reason}"
        )

    if not isinstance(assessment.get("affected_jobs"), list) or (
        TARGET_JOB not in assessment["affected_jobs"]
    ):
        raise FixGenerationError(
            f"Required evidence is missing the affected {TARGET_JOB} job."
        )

    if not isinstance(assessment.get("diff"), str) or not assessment["diff"].strip():
        raise FixGenerationError("Required remediation evidence is missing.")

    if re.search(
        rf"^[ \t]+{re.escape(TARGET_JOB)}\s*:",
        workflow_content,
        flags=re.MULTILINE,
    ):
        raise FixGenerationError(
            f"The {TARGET_JOB} job already exists; refusing to duplicate it."
        )

    job_text = _job_from_evidence(assessment["diff"])
    fixed_workflow = _insert_before_deploy(workflow_content, job_text)
    unified_diff = "".join(
        difflib.unified_diff(
            workflow_content.splitlines(keepends=True),
            fixed_workflow.splitlines(keepends=True),
            fromfile="a/.github/workflows/ci.yml",
            tofile="b/.github/workflows/ci.yml",
        )
    )

    if not unified_diff:
        raise FixGenerationError("The controlled fix did not change the workflow.")

    return FixResult(
        original_workflow=workflow_content,
        fixed_workflow=fixed_workflow,
        unified_diff=unified_diff,
    )