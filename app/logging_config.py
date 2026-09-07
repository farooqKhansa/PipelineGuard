"""
Structured logging: every log record can carry event, run_id, repository,
workflow_run_id, stage, status, duration_ms as extra fields. Formatted as
JSON so it's greppable/ingestible in a real deployment.
"""
import json
import logging
import sys

from app.config import get_settings

RESERVED = set(logging.LogRecord("", 0, "", 0, "", (), None).__dict__.keys())


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key not in RESERVED and key != "message":
                payload[key] = value
        return json.dumps(payload, default=str)


def configure_logging():
    settings = get_settings()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(settings.LOG_LEVEL)
