"""HTTP schemas for the standalone Detection Core service."""

from __future__ import annotations

from math import isfinite
from typing import Literal

from pydantic import BaseModel, field_validator


class DetectRequest(BaseModel):
    repo: str
    workflow_run_id: str
    diff: str

    @field_validator("diff")
    @classmethod
    def validate_diff(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("diff must contain non-whitespace workflow content")
        return value


class DetectionResponse(BaseModel):
    status: Literal["clean", "suspicious", "malicious"]
    risk_score: float

    @field_validator("risk_score")
    @classmethod
    def validate_risk_score(cls, value: float) -> float:
        if not isfinite(value) or not 0.0 <= value <= 1.0:
            raise ValueError("risk_score must be finite and within 0–1")
        return value