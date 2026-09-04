"""Standalone HTTP Detection Core service."""

from __future__ import annotations

import logging
from functools import lru_cache

from fastapi import FastAPI, HTTPException
from pydantic_settings import BaseSettings, SettingsConfigDict

from .detector import DetectionError, HuggingFaceDetector
from .schemas import DetectRequest, DetectionResponse

logger = logging.getLogger("pipelineguard.detection_core")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    MODEL_ID: str = "FaizaML/pipelineguard-codebert-risk"
    MODEL_INPUT_MODE: str = "workflow_text"
    MODEL_MAX_LENGTH: int = 512
    MODEL_PADDING: str = "max_length"
    MODEL_TRUNCATION: bool = True
    CLEAN_MAX_RISK: float = 0.20
    MALICIOUS_MIN_RISK: float = 0.80


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def get_detector() -> HuggingFaceDetector:
    settings = get_settings()
    return HuggingFaceDetector(
        model_id=settings.MODEL_ID,
        input_mode=settings.MODEL_INPUT_MODE,
        max_length=settings.MODEL_MAX_LENGTH,
        padding=settings.MODEL_PADDING,
        truncation=settings.MODEL_TRUNCATION,
        clean_max_risk=settings.CLEAN_MAX_RISK,
        malicious_min_risk=settings.MALICIOUS_MIN_RISK,
    )


app = FastAPI(title="PipelineGuard Detection Core", version="1.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    """Report service availability without loading the checkpoint."""

    return {"status": "ok", "model_id": get_settings().MODEL_ID}


@app.post("/detect", response_model=DetectionResponse)
def detect(request: DetectRequest) -> DetectionResponse:
    try:
        result = get_detector().detect(request.diff)
    except (DetectionError, ValueError) as error:
        logger.error("detection_failed", extra={"error": str(error)})
        raise HTTPException(
            status_code=503,
            detail={
                "error": "detection_unavailable",
                "message": str(error),
            },
        ) from error
    return DetectionResponse.model_validate(result)