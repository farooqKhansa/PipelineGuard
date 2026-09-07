"""Browser-facing boundary endpoint for the existing agentic layer."""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.services.agentic_boundary import (
    AgenticLayerUnavailable,
    InvalidAgenticRequest,
    run_agentic_boundary,
)


router = APIRouter(prefix="/api/v1/agent", tags=["agent"])


class AgentDecisionRequest(BaseModel):
    """Canonical 0–1 assessment plus complete workflow content."""

    model_config = ConfigDict(extra="forbid")

    assessment: dict[str, Any]
    workflow_content: str = Field(min_length=1)


@router.post("/decision")
def agent_decision(body: AgentDecisionRequest) -> dict[str, Any]:
    """Return the authoritative agentic result without GitHub side effects."""

    try:
        return run_agentic_boundary(body.assessment, body.workflow_content)
    except InvalidAgenticRequest as error:
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_agentic_request", "message": str(error)},
        ) from error
    except AgenticLayerUnavailable as error:
        raise HTTPException(
            status_code=503,
            detail={"error": "agentic_layer_unavailable", "message": str(error)},
        ) from error