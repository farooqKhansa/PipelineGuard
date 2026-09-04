"""Locate the read-only Workstream 2 package for integration tests."""

import os
from pathlib import Path
from zipfile import ZipFile


def authoritative_root() -> Path:
    configured = os.getenv("AGENTIC_LAYER_PATH", "").strip()
    if configured and Path(configured).is_dir():
        return Path(configured)

    extracted = Path("/tmp/pipelineguard_authoritative/PipelineGuard")
    if extracted.is_dir():
        return extracted

    archive = Path(__file__).parents[1] / "PipelineGuard-current-backup.zip"
    if not archive.is_file():
        raise RuntimeError(
            "Authoritative Workstream 2 package is unavailable for tests."
        )

    with ZipFile(archive) as source:
        source.extractall("/tmp/pipelineguard_authoritative")
    if not extracted.is_dir():
        raise RuntimeError(
            "The backup archive did not contain PipelineGuard/agent."
        )
    return extracted