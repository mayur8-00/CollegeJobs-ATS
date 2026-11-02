
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import resume_improvement
# =========================================================
# ENVIRONMENT CONFIGURATION
# =========================================================

# main.py is located in backend/app/main.py.
# The .env file is expected in the backend directory.
BACKEND_DIR = Path(__file__).resolve().parents[1]
ENV_FILE = BACKEND_DIR / ".env"

load_dotenv(dotenv_path=ENV_FILE, override=False)

# Import routers only after loading environment variables.
from app.api.auth import router as auth_router
from app.api.jobs import router as jobs_router
from app.api.applications import router as applications_router
from app.api.dashboard import router as dashboard_router
from app.api.assessment import router as assessment_router
from app.api.coding_assessment import (
    router as coding_assessment_router,
)

from app.api.ai_routes import router as ai_router

from app.core.config import CORS_ORIGINS
from app.core.security import hash_password
from app.db import Base, engine, SessionLocal
from app.models import User


def initialize_database():
    print("\n========================================")
    print("STARTING COLLEGE JOBS ATS API")
    print("========================================")

    print(f"Environment file: {ENV_FILE}")
    print(f"Environment file exists: {ENV_FILE.is_file()}")

    import os
    print(
        "Judge0 URL configured:",
        bool(os.getenv("JUDGE0_BASE_URL", "").strip()),
    )

    # Create missing tables without creating demo accounts.
    Base.metadata.create_all(bind=engine)

    print("Database tables initialized.")
    print("Demo account seeding is disabled.")
    print("API STARTUP COMPLETE")
    print("========================================\n")

# =========================================================
# APPLICATION LIFESPAN
# =========================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield

# =========================================================
# FASTAPI APPLICATION
# =========================================================

app = FastAPI(
    title="College Jobs ATS API",
    version="2.0.0",
    description=(
        "Single FastAPI service for authentication, jobs, "
        "applications, coding assessments, local AI, "
        "and ATS analysis."
    ),
    lifespan=lifespan,
)

# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# API ROUTES
# =========================================================

app.include_router(auth_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")
app.include_router(applications_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")

app.include_router(
    resume_improvement.router,
    prefix="/api",
    tags=["Resume Improvement"]
)
app.include_router(coding_assessment_router, prefix="/api")
app.include_router(assessment_router, prefix="/api")


# ai_routes.py should define its own intended prefix,
# for example APIRouter(prefix="/api/ai").
app.include_router(ai_router)


# =========================================================
# ROOT
# =========================================================

@app.get("/")
def root():
    return {
        "message": "College Jobs ATS API is running",
        "architecture": "Angular + FastAPI + MySQL + Ollama",
    }


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "College Jobs ATS API",
    }
