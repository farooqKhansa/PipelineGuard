"""Locate the authoritative Workstream 2 package in the consolidated project."""

import os
from pathlib import Path


def authoritative_root() -> Path:
    configured = os.getenv("AGENTIC_LAYER_PATH", "").strip()
    if configured and Path(configured).is_dir():
        return Path(configured)

    # In the consolidated project, agent/ lives at the project root.
    project_root = Path(__file__).parents[1]
    if (project_root / "agent" / "orchestrator.py").is_file():
        return project_root

    raise RuntimeError(
        "Authoritative Workstream 2 package is unavailable for tests."
    )
