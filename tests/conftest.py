import os

os.environ["DATABASE_URL"] = "sqlite:///./test_pipelineguard.db"
os.environ["DEMO_MODE"] = "true"
os.environ["GITHUB_WEBHOOK_SECRET"] = "test-secret"

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.main import app
from app.seed import run as seed_run


@pytest.fixture(scope="session", autouse=True)
def _prepare_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed_run()
    yield
    Base.metadata.drop_all(bind=engine)
    try:
        os.remove("test_pipelineguard.db")
    except OSError:
        pass


@pytest.fixture()
def client():
    return TestClient(app)


@pytest.fixture()
def settings():
    return get_settings()
