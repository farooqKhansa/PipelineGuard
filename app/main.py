import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, engine
from app.logging_config import configure_logging
from app.routers import agent, analyze, dashboard, demo, health, trace, webhook

configure_logging()
logger = logging.getLogger("pipelineguard.main")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Convenience for dev/demo: ensures tables exist even if Alembic hasn't
    # been run yet. Alembic migrations remain the source of truth for schema
    # changes (see alembic/versions/).
    Base.metadata.create_all(bind=engine)
    logger.info("startup_complete", extra={"event": "startup_complete", "env": settings.ENV, "demo_mode": settings.DEMO_MODE})
    yield


app = FastAPI(title=settings.APP_NAME, version=settings.GATEWAY_VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(dashboard.router)
app.include_router(webhook.router)
app.include_router(analyze.router)
app.include_router(demo.router)
app.include_router(trace.router)
app.include_router(agent.router)
