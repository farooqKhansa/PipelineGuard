"""Local verification of generated GitHub Actions workflow changes."""

from dataclasses import dataclass
import re
import shutil
import subprocess
from difflib import SequenceMatcher
from typing import Any, Mapping

import yaml


PASSED = "passed"
FAILED = "failed"
SKIPPED = "skipped"
PASSED_WITH_SKIPS = "passed_with_skips"

TARGET_JOB = "security-tests"
EXPECTED_JOB_FRAGMENTS = (
    "security-tests:",
    "needs: test",
    "runs-on: ubuntu-latest",
    "name: Run security tests",
    "run: ./scripts/security-tests.sh",
)


@dataclass(frozen=True)
class CheckResult:
    """The observed result of one verification check."""

    name: str
    status: str
    message: str

    def to_dict(self) -> dict[str, str]:
        return {
            "name": self.name,
            "status": self.status,
            "message": self.message,
        }


@dataclass(frozen=True)
class VerificationResult:
    """Structured verification output without an execution claim."""

    status: str
    checks: tuple[CheckResult, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "checks": [check.to_dict() for check in self.checks],
        }


def _yaml_check(workflow_content: str) -> CheckResult:
    if not isinstance(workflow_content, str) or not workflow_content.strip():
        return CheckResult(
            "YAML parsing",
            FAILED,
            "Generated workflow content is missing or empty.",
        )

    try:
        parsed_workflow = yaml.safe_load(workflow_content)
    except yaml.YAMLError as error:
        return CheckResult(
            "YAML parsing",
            FAILED,
            f"Generated workflow is not valid YAML: {error}",
        )

    if not isinstance(parsed_workflow, Mapping):
        return CheckResult(
            "YAML parsing",
            FAILED,
            "Generated workflow must contain a YAML mapping.",
        )

    return CheckResult(
        "YAML parsing",
        PASSED,
        "Generated workflow parsed as a YAML mapping.",
    )


def _yamllint_check(workflow_content: str) -> CheckResult:
    yamllint_path = shutil.which("yamllint")
    if yamllint_path is None:
        return CheckResult(
            "yamllint",
            SKIPPED,
            "yamllint is not installed.",
        )

    try:
        completed = subprocess.run(
            [yamllint_path, "-"],
            input=workflow_content,
            text=True,
            capture_output=True,
            check=False,
        )
    except OSError as error:
        return CheckResult(
            "yamllint",
            FAILED,
            f"yamllint could not be executed: {error}",
        )

    output = "\n".join(
        part.strip() for part in (completed.stdout, completed.stderr) if part.strip()
    )
    if completed.returncode == 0:
        return CheckResult(
            "yamllint",
            PASSED,
            output or "yamllint completed without errors.",
        )

    return CheckResult(
        "yamllint",
        FAILED,
        output or f"yamllint exited with status {completed.returncode}.",
    )


def _job_lines(workflow_content: str) -> tuple[list[str], list[int]]:
    lines = workflow_content.splitlines()
    job_pattern = re.compile(r"^  " + re.escape(TARGET_JOB) + r"\s*:\s*(?:#.*)?$")
    next_job_pattern = re.compile(r"^  [A-Za-z0-9_.-]+\s*:\s*(?:#.*)?$")
    start_indexes = [
        index for index, line in enumerate(lines) if job_pattern.match(line)
    ]

    if len(start_indexes) != 1:
        return [], start_indexes

    start = start_indexes[0]
    end = len(lines)
    for index in range(start + 1, len(lines)):
        if next_job_pattern.match(lines[index]):
            end = index
            break
    return lines[start:end], start_indexes


def _scope_check(
    original_workflow: str, fixed_workflow: str
) -> CheckResult:
    if not isinstance(original_workflow, str) or not isinstance(fixed_workflow, str):
        return CheckResult(
            "Change scope",
            FAILED,
            "Original and fixed workflow content must both be strings.",
        )

    original_lines = original_workflow.splitlines(keepends=True)
    fixed_lines = fixed_workflow.splitlines(keepends=True)
    _, original_job_indexes = _job_lines(original_workflow)
    fixed_job, fixed_job_indexes = _job_lines(fixed_workflow)

    if original_job_indexes:
        return CheckResult(
            "Change scope",
            FAILED,
            f"The original workflow already contains the {TARGET_JOB} job.",
        )

    if len(fixed_job_indexes) != 1:
        return CheckResult(
            "Change scope",
            FAILED,
            f"The fixed workflow must contain exactly one {TARGET_JOB} job.",
        )

    missing_fragments = [
        fragment
        for fragment in EXPECTED_JOB_FRAGMENTS
        if fragment not in "\n".join(fixed_job)
    ]
    if missing_fragments:
        return CheckResult(
            "Change scope",
            FAILED,
            "The restored security-tests job is missing expected configuration: "
            + ", ".join(missing_fragments)
            + ".",
        )

    deploy_indexes = [
        index
        for index, line in enumerate(fixed_lines)
        if re.match(r"^  deploy\s*:\s*(?:#.*)?$", line.rstrip("\r\n"))
    ]
    if len(deploy_indexes) != 1 or fixed_job_indexes[0] >= deploy_indexes[0]:
        return CheckResult(
            "Change scope",
            FAILED,
            f"The {TARGET_JOB} job must be restored immediately before deploy.",
        )

    opcodes = SequenceMatcher(
        None, original_lines, fixed_lines, autojunk=False
    ).get_opcodes()
    changes = [opcode for opcode in opcodes if opcode[0] != "equal"]
    if len(changes) != 1 or changes[0][0] != "insert":
        return CheckResult(
            "Change scope",
            FAILED,
            "The generated workflow changes content outside the security-tests insertion.",
        )

    inserted_lines = fixed_lines[changes[0][3] : changes[0][4]]
    if TARGET_JOB not in "".join(inserted_lines):
        return CheckResult(
            "Change scope",
            FAILED,
            "The only generated insertion is not the expected security-tests restoration.",
        )

    return CheckResult(
        "Change scope",
        PASSED,
        "The security-tests job was restored and unrelated workflow lines are unchanged.",
    )


def _overall_status(checks: tuple[CheckResult, ...]) -> str:
    if any(check.status == FAILED for check in checks):
        return FAILED
    if any(check.status == SKIPPED for check in checks):
        return PASSED_WITH_SKIPS
    return PASSED


def verify_workflow(
    original_workflow: str, fixed_workflow: str
) -> VerificationResult:
    """Verify syntax, available linting, and the narrow restoration scope."""

    checks = (
        _yaml_check(fixed_workflow),
        _yamllint_check(fixed_workflow),
        _scope_check(original_workflow, fixed_workflow),
    )
    return VerificationResult(_overall_status(checks), checks)