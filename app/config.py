"""
Central configuration. All values come from environment variables so the same
image runs unmodified in dev, docker-compose, and Alibaba Cloud.
"""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Core ---
    APP_NAME: str = "PipelineGuard Gateway"
    ENV: str = "development"
    DEMO_MODE: bool = True
    GATEWAY_VERSION: str = "gw-0.4.2"

    # --- Database ---
    # Defaults to a local SQLite file so the service is runnable with zero
    # external dependencies during development. docker-compose points this at
    # Postgres, which is the production target per the spec.
    DATABASE_URL: str = "sqlite:///./pipelineguard.db"

    # --- CORS ---
    FRONTEND_ORIGINS: str = "http://localhost:3000"

    @property
    def frontend_origins_list(self) -> List[str]:
        return [o.strip() for o in self.FRONTEND_ORIGINS.split(",") if o.strip()]

    # --- External services ---
    DETECTION_CORE_URL: str = ""
    AGENTIC_LAYER_URL: str = ""
    # "external" preserves the existing HTTP Detection Core path. The local
    # provider is opt-in so a deployment cannot unexpectedly download a model.
    DETECTION_PROVIDER: str = "external"
    DETECTION_MODEL_ID: str = "FaizaML/pipelineguard-codebert-risk"
    DETECTION_MODEL_INPUT_MODE: str = "workflow_text"
    DETECTION_MODEL_MAX_LENGTH: int = 512
    DETECTION_MODEL_PADDING: str = "max_length"
    DETECTION_MODEL_TRUNCATION: bool = True
    DETECTION_CLEAN_MAX_RISK: float = 0.20
    DETECTION_MALICIOUS_MIN_RISK: float = 0.80
    # Filesystem path whose child packages are ``agent`` and ``audit``. The
    # authoritative Workstream 2 package is kept outside the dashboard app
    # and imported through the boundary adapter.
    AGENTIC_LAYER_PATH: str = ""
    # Explicit source scale for non-demo Detection Core responses. "unknown"
    # prevents the adapter from guessing how a score should be interpreted.
    DETECTION_RISK_SCORE_SCALE: str = "unknown"
    EXTERNAL_REQUEST_TIMEOUT_SECONDS: float = 10.0
    EXTERNAL_REQUEST_MAX_RETRIES: int = 2

    # --- GitHub ---
    GITHUB_APP_ID: str = ""
    GITHUB_APP_PRIVATE_KEY: str = ""
    GITHUB_WEBHOOK_SECRET: str = "dev-webhook-secret"
    GITHUB_TOKEN: str = ""  # optional PAT fallback for demo/dev use
    GITHUB_API_URL: str = "https://api.github.com"

    # --- Logging ---
    LOG_LEVEL: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
