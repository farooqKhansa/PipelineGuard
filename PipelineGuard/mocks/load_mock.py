"""Load and validate the mocked Workstream 1 risk assessment."""

import json
import sys
from pathlib import Path
from pprint import pprint


REQUIRED_FIELDS = (
    "risk_score",
    "confidence",
    "reasons",
    "affected_jobs",
    "graph_path",
    "model_breakdown",
    "repo",
    "workflow_run_id",
    "diff",
)

REQUIRED_MODEL_FIELDS = (
    "pipeline_score",
    "code_score",
    "combined_score",
)


def load_and_validate_mock():
    mock_path = Path(__file__).with_name("risk_assessment_auto_fix.json")

    with mock_path.open(encoding="utf-8") as mock_file:
        assessment = json.load(mock_file)

    if not isinstance(assessment, dict):
        raise ValueError("Risk assessment must be a JSON object.")

    missing_fields = [
        field for field in REQUIRED_FIELDS if field not in assessment
    ]
    if missing_fields:
        raise ValueError(
            "Missing required top-level field(s): " + ", ".join(missing_fields)
        )

    model_breakdown = assessment["model_breakdown"]
    if not isinstance(model_breakdown, dict):
        raise ValueError("model_breakdown must be a JSON object.")

    missing_model_fields = [
        field
        for field in REQUIRED_MODEL_FIELDS
        if field not in model_breakdown
    ]
    if missing_model_fields:
        raise ValueError(
            "Missing required model_breakdown field(s): "
            + ", ".join(missing_model_fields)
        )

    return assessment


def main():
    try:
        assessment = load_and_validate_mock()
    except (OSError, json.JSONDecodeError, ValueError) as error:
        print(f"ERROR: Could not load or validate risk assessment: {error}", file=sys.stderr)
        return 1

    print("Parsed PipelineGuard risk assessment:")
    pprint(assessment, sort_dicts=False)
    print("\nSUCCESS: Mock risk assessment passed validation.")
    return 0


if __name__ == "__main__":
    sys.exit(main())