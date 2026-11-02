
"""
Coding Assessment API for CollegeJobs ATS.

Candidate code is executed by Judge0, outside the FastAPI process.

Public Judge0:
    JUDGE0_BASE_URL=https://ce.judge0.com
    JUDGE0_API_KEY=
    JUDGE0_API_HOST=

RapidAPI Judge0:
    JUDGE0_BASE_URL=https://judge0-ce.p.rapidapi.com
    JUDGE0_API_KEY=your_key
    JUDGE0_API_HOST=judge0-ce.p.rapidapi.com
"""

import os
from datetime import datetime
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.db import Base, get_db
from app.models import Job, User


router = APIRouter(
    prefix="/coding-assessment",
    tags=["Coding Assessment"],
)


# =========================================================
# LANGUAGE CONFIGURATION
# =========================================================

LANGUAGES = {
    "python": {"id": 71, "label": "Python"},
    "javascript": {"id": 63, "label": "JavaScript"},
    "java": {"id": 62, "label": "Java"},
    "csharp": {"id": 51, "label": "C#"},
}


# =========================================================
# TEST CASES
#
# These cases expect programs to read stdin and print results.
# Add hidden cases before using this for real candidate ranking.
# =========================================================

QUESTION_CASES = {
    1: [
        {
            "name": "Sample: Two Sum",
            "stdin": "2 7 11 15\n9\n",
            "expected_output": "0 1",
        },
    ],
    2: [
        {
            "name": "Sample: First Unique Character",
            "stdin": "swiss\n",
            "expected_output": "w",
        },
    ],
    3: [
        {
            "name": "Sample: Balanced Brackets",
            "stdin": "{[()]}\n",
            "expected_output": "true",
        },
    ],
}


# =========================================================
# REQUEST SCHEMAS
# =========================================================

class CodingRunIn(BaseModel):
    job_id: int = Field(gt=0)
    question_id: int = Field(ge=1)
    language: Literal["python", "javascript", "java", "csharp"]
    source_code: str = Field(min_length=1, max_length=50000)


class CodeSubmission(BaseModel):
    question_id: int = Field(ge=1)
    language: Literal["python", "javascript", "java", "csharp"]
    source_code: str = Field(min_length=1, max_length=50000)


class CodingSubmitIn(BaseModel):
    job_id: int = Field(gt=0)
    submissions: list[CodeSubmission] = Field(
        min_length=1,
        max_length=30,
    )


# =========================================================
# DATABASE MODEL
# =========================================================

class CodingSubmissionRecord(Base):
    __tablename__ = "coding_assessment_submissions"

    id = Column(Integer, primary_key=True, index=True)

    job_id = Column(
        Integer,
        ForeignKey("jobs.id"),
        nullable=False,
        index=True,
    )

    student_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    question_id = Column(Integer, nullable=False)
    language = Column(String(20), nullable=False)
    source_code = Column(Text, nullable=False)

    score = Column(Integer, nullable=False, default=0)
    passed_tests = Column(Integer, nullable=False, default=0)
    total_tests = Column(Integer, nullable=False, default=0)

    status = Column(
        String(30),
        nullable=False,
        default="submitted",
    )

    execution_error = Column(Text, nullable=True)

    submitted_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        index=True,
    )


# =========================================================
# VALIDATION AND ACCESS HELPERS
# =========================================================

def _job_or_404(db: Session, job_id: int) -> Job:
    job = db.query(Job).filter(Job.id == job_id).first()

    if job is None:
        raise HTTPException(
            status_code=404,
            detail="Job not found.",
        )

    return job


def _require_student(user: User) -> None:
    if user.role != "student":
        raise HTTPException(
            status_code=403,
            detail="Only students can run or submit coding assessments.",
        )


def _require_results_access(job: Job, user: User) -> None:
    if user.role not in ("admin", "superadmin", "company"):
        raise HTTPException(
            status_code=403,
            detail="Only companies, admins, or superadmins can review results.",
        )

    if (
        user.role == "company"
        and getattr(job, "company_id", None) != user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="You can only review submissions for your own jobs.",
        )


def _require_leaderboard_access(user: User) -> None:
    if user.role not in ("admin", "superadmin", "company"):
        raise HTTPException(
            status_code=403,
            detail="Only companies, admins, or superadmins can review results.",
        )


# =========================================================
# JUDGE0 CONFIGURATION
# =========================================================

def _judge0_settings() -> tuple[str, dict[str, str]]:
    base_url = os.getenv(
        "JUDGE0_BASE_URL",
        "https://ce.judge0.com",
    ).strip().rstrip("/")

    api_key = os.getenv("JUDGE0_API_KEY", "").strip()
    api_host = os.getenv(
        "JUDGE0_API_HOST",
        "judge0-ce.p.rapidapi.com",
    ).strip()

    if not base_url:
        raise HTTPException(
            status_code=503,
            detail="Set JUDGE0_BASE_URL in your backend .env file.",
        )

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    if "rapidapi.com" in base_url.lower():
        if not api_key or not api_host:
            raise HTTPException(
                status_code=503,
                detail="Configure JUDGE0_API_KEY and JUDGE0_API_HOST.",
            )

        headers["X-RapidAPI-Key"] = api_key
        headers["X-RapidAPI-Host"] = api_host

    elif api_key:
        headers["X-Auth-Token"] = api_key

    return base_url, headers


# =========================================================
# JUDGE0 EXECUTION
# =========================================================

async def _judge0_execute(
    language: str,
    source_code: str,
    stdin: str = "",
) -> dict:
    if language not in LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported programming language.",
        )

    base_url, headers = _judge0_settings()

    payload = {
        "language_id": LANGUAGES[language]["id"],
        "source_code": source_code,
        "stdin": stdin,
        "cpu_time_limit": 2,
        "wall_time_limit": 5,
        "memory_limit": 128000,
    }

    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=8.0),
        ) as client:
            response = await client.post(
                f"{base_url}/submissions",
                params={
                    "base64_encoded": "false",
                    "wait": "true",
                },
                json=payload,
                headers=headers,
            )

        if response.status_code in (401, 403):
            print(
                "Judge0 authentication error:",
                response.status_code,
                response.text[:300],
            )
            raise HTTPException(
                status_code=502,
                detail=(
                    "Judge0 rejected authentication. Check the endpoint, "
                    "credentials, or provider subscription."
                ),
            )

        if response.status_code == 429:
            raise HTTPException(
                status_code=503,
                detail="Judge0 rate limit reached. Try again later.",
            )

        if response.status_code >= 500:
            print(
                "Judge0 server error:",
                response.status_code,
                response.text[:300],
            )
            raise HTTPException(
                status_code=502,
                detail="Judge0 is temporarily unavailable.",
            )

        if response.status_code >= 400:
            print(
                "Judge0 request error:",
                response.status_code,
                response.text[:300],
            )
            raise HTTPException(
                status_code=502,
                detail=f"Judge0 rejected the request ({response.status_code}).",
            )

        try:
            result = response.json()
        except ValueError as exc:
            raise HTTPException(
                status_code=502,
                detail="Judge0 returned invalid JSON.",
            ) from exc

        if (
            not isinstance(result, dict)
            or not isinstance(result.get("status"), dict)
        ):
            raise HTTPException(
                status_code=502,
                detail=(
                    "Judge0 returned no completed result. "
                    "Try again shortly."
                ),
            )

        return result

    except HTTPException:
        raise

    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=504,
            detail="Judge0 timed out. Please try again.",
        ) from exc

    except httpx.RequestError as exc:
        print("Judge0 connection error:", str(exc))
        raise HTTPException(
            status_code=502,
            detail="Could not connect to Judge0. Check your network and URL.",
        ) from exc


# =========================================================
# OUTPUT HELPERS
# =========================================================

def _normalise_output(value: str | None) -> str:
    return " ".join((value or "").strip().split())


def _execution_details(result: dict) -> tuple[str, str]:
    status_text = (
        result.get("status") or {}
    ).get("description", "Unknown")

    error = (
        result.get("stderr")
        or result.get("compile_output")
        or result.get("message")
        or ""
    )

    return status_text, error.strip()


async def _evaluate_question(
    language: str,
    source_code: str,
    question_id: int,
) -> dict:
    cases = QUESTION_CASES.get(question_id)

    if not cases:
        raise HTTPException(
            status_code=404,
            detail="No executable test cases are configured for this question.",
        )

    results = []

    for case in cases:
        result = await _judge0_execute(
            language=language,
            source_code=source_code,
            stdin=case["stdin"],
        )

        status_text, error = _execution_details(result)
        stdout = result.get("stdout") or ""

        passed = (
            status_text == "Accepted"
            and _normalise_output(stdout)
            == _normalise_output(case["expected_output"])
        )

        results.append({
            "name": case["name"],
            "passed": passed,
            "expected": case["expected_output"],
            "actual": stdout.strip(),
            "message": (
                "Passed" if passed else error or status_text
            ),
            "status": status_text,
        })

    passed_count = sum(
        1 for item in results if item["passed"]
    )

    return {
        "test_results": results,
        "passed_tests": passed_count,
        "total_tests": len(results),
    }


# =========================================================
# LEADERBOARD / ALL RESULTS
#
# IMPORTANT: This route must be declared before /{job_id}.
# =========================================================

@router.get("/results")
def coding_results_leaderboard(
    q: str | None = None,
    sort: Literal[
        "score_high",
        "score_low",
        "newest",
        "oldest",
    ] = "score_high",
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """
    Return one leaderboard row per student/job pair.

    Companies see only their own jobs.
    Admins and superadmins see results across all jobs.

    Repeated submissions do not inflate a candidate's score:
    only the latest submission per question is used.
    """
    _require_leaderboard_access(user)

    query = (
        db.query(CodingSubmissionRecord, Job, User)
        .join(
            Job,
            CodingSubmissionRecord.job_id == Job.id,
        )
        .join(
            User,
            CodingSubmissionRecord.student_id == User.id,
        )
    )

    if user.role == "company":
        query = query.filter(Job.company_id == user.id)

    rows = query.order_by(
        CodingSubmissionRecord.submitted_at.desc(),
        CodingSubmissionRecord.id.desc(),
    ).all()

    grouped = {}

    for record, job, student in rows:
        key = (record.job_id, record.student_id)

        if key not in grouped:
            grouped[key] = {
                "job_id": job.id,
                "job_title": job.title,
                "student_id": student.id,
                "student_name": student.name,
                "student_email": student.email,
                "latest_by_question": {},
                "latest_submission_at": record.submitted_at,
            }

        candidate = grouped[key]
        previous = candidate["latest_by_question"].get(
            record.question_id
        )

        if (
            previous is None
            or (
                record.submitted_at
                and (
                    previous.submitted_at is None
                    or record.submitted_at > previous.submitted_at
                    or (
                        record.submitted_at == previous.submitted_at
                        and record.id > previous.id
                    )
                )
            )
        ):
            candidate["latest_by_question"][record.question_id] = record

        current_latest = candidate["latest_submission_at"]

        if (
            record.submitted_at
            and (
                current_latest is None
                or record.submitted_at > current_latest
            )
        ):
            candidate["latest_submission_at"] = record.submitted_at

    results = []

    for candidate in grouped.values():
        latest = list(candidate["latest_by_question"].values())

        passed = sum(record.passed_tests for record in latest)
        total = sum(record.total_tests for record in latest)

        score = round((passed / total) * 100) if total else 0

        submitted_at = candidate["latest_submission_at"]

        results.append({
            "job_id": candidate["job_id"],
            "job_title": candidate["job_title"],
            "student_id": candidate["student_id"],
            "student_name": candidate["student_name"],
            "student_email": candidate["student_email"],
            "score": score,
            "passed_tests": passed,
            "total_tests": total,
            "questions_submitted": len(latest),
            "submitted_at": (
                submitted_at.isoformat()
                if submitted_at else None
            ),
        })

    if q and q.strip():
        term = q.strip().casefold()
        results = [
            item for item in results
            if term in item["student_name"].casefold()
            or term in item["student_email"].casefold()
            or term in item["job_title"].casefold()
            or term in str(item["student_id"])
        ]

    if sort == "score_high":
        results.sort(
            key=lambda item: (
                -item["score"],
                -item["passed_tests"],
                item["submitted_at"] or "",
            ),
            reverse=False,
        )
    elif sort == "score_low":
        results.sort(
            key=lambda item: (
                item["score"],
                item["submitted_at"] or "",
            )
        )
    elif sort == "newest":
        results.sort(
            key=lambda item: item["submitted_at"] or "",
            reverse=True,
        )
    else:
        results.sort(
            key=lambda item: item["submitted_at"] or "",
        )

    for rank, item in enumerate(results, start=1):
        item["rank"] = rank

    scores = [item["score"] for item in results]

    return {
        "total": len(results),
        "average_score": (
            round(sum(scores) / len(scores), 2)
            if scores else 0
        ),
        "scores_80_plus": sum(
            score >= 80 for score in scores
        ),
        "results": results,
    }


# =========================================================
# GET CODING ASSESSMENT
# =========================================================

@router.get("/{job_id}")
def get_coding_assessment(
    job_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    job = _job_or_404(db, job_id)

    if user.role not in ("student", "admin", "superadmin", "company"):
        raise HTTPException(
            status_code=403,
            detail="Not allowed to view this assessment.",
        )

    if (
        user.role == "company"
        and getattr(job, "company_id", None) != user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="You can only view assessments for your own jobs.",
        )

    try:
        _judge0_settings()
        execution_configured = True
    except HTTPException:
        execution_configured = False

    return {
        "job_id": job.id,
        "job_title": job.title,
        "languages": [
            {"value": key, "label": value["label"]}
            for key, value in LANGUAGES.items()
        ],
        "duration_minutes": 45,
        "execution_configured": execution_configured,
    }


# =========================================================
# RUN CODE
# =========================================================

@router.post("/run")
async def run_code(
    payload: CodingRunIn,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    _require_student(user)
    _job_or_404(db, payload.job_id)

    evaluated = await _evaluate_question(
        language=payload.language,
        source_code=payload.source_code,
        question_id=payload.question_id,
    )

    passed = evaluated["passed_tests"]
    total = evaluated["total_tests"]

    return {
        "message": f"Run complete: {passed}/{total} tests passed.",
        **evaluated,
    }


# =========================================================
# SUBMIT CODING ASSESSMENT
# =========================================================

@router.post("/submit")
async def submit_coding_assessment(
    payload: CodingSubmitIn,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    _require_student(user)
    _job_or_404(db, payload.job_id)

    saved = []
    total_passed = 0
    total_tests = 0

    try:
        for item in payload.submissions:
            source_code = item.source_code.strip()

            if not source_code:
                continue

            # Validate that this question has configured test cases.
            if item.question_id not in QUESTION_CASES:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Question {item.question_id} has no configured "
                        "test cases and cannot be scored."
                    ),
                )

            evaluated = await _evaluate_question(
                language=item.language,
                source_code=source_code,
                question_id=item.question_id,
            )

            passed = evaluated["passed_tests"]
            count = evaluated["total_tests"]

            score = round((passed / count) * 100) if count else 0

            errors = [
                result["message"]
                for result in evaluated["test_results"]
                if not result["passed"]
            ]

            record = CodingSubmissionRecord(
                job_id=payload.job_id,
                student_id=user.id,
                question_id=item.question_id,
                language=item.language,
                source_code=source_code,
                score=score,
                passed_tests=passed,
                total_tests=count,
                status="submitted",
                execution_error=(
                    "\n".join(
                        error for error in errors if error
                    )[:8000] or None
                ),
            )

            db.add(record)
            db.flush()

            saved.append({
                "submission_id": record.id,
                "question_id": item.question_id,
                "language": item.language,
                "score": score,
                "passed_tests": passed,
                "total_tests": count,
                "status": record.status,
            })

            total_passed += passed
            total_tests += count

        if not saved:
            raise HTTPException(
                status_code=400,
                detail="No non-empty code submissions were provided.",
            )

        db.commit()

        for item in saved:
            db.refresh(
                db.query(CodingSubmissionRecord)
                .filter(
                    CodingSubmissionRecord.id == item["submission_id"]
                )
                .first()
            )

    except Exception:
        db.rollback()
        raise

    overall_score = (
        round((total_passed / total_tests) * 100)
        if total_tests else 0
    )

    return {
        "message": "Coding assessment submitted and saved for review.",
        "job_id": payload.job_id,
        "overall_score": overall_score,
        "passed_tests": total_passed,
        "total_tests": total_tests,
        "submissions": saved,
    }


# =========================================================
# RESULTS FOR ONE JOB
# =========================================================

@router.get("/job/{job_id}/results")
def review_coding_results(
    job_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    job = _job_or_404(db, job_id)
    _require_results_access(job, user)

    records = (
        db.query(CodingSubmissionRecord)
        .filter(CodingSubmissionRecord.job_id == job_id)
        .order_by(
            CodingSubmissionRecord.submitted_at.desc(),
            CodingSubmissionRecord.id.desc(),
        )
        .all()
    )

    student_ids = {record.student_id for record in records}

    users = (
        {
            student.id: student
            for student in db.query(User)
            .filter(User.id.in_(student_ids))
            .all()
        }
        if student_ids else {}
    )

    return {
        "job_id": job_id,
        "job_title": job.title,
        "results": [
            {
                "submission_id": record.id,
                "student_id": record.student_id,
                "student_name": (
                    users[record.student_id].name
                    if record.student_id in users else "Unknown"
                ),
                "student_email": (
                    users[record.student_id].email
                    if record.student_id in users else ""
                ),
                "question_id": record.question_id,
                "language": record.language,
                "source_code": record.source_code,
                "score": record.score,
                "passed_tests": record.passed_tests,
                "total_tests": record.total_tests,
                "status": record.status,
                "execution_error": record.execution_error,
                "submitted_at": (
                    record.submitted_at.isoformat()
                    if record.submitted_at else None
                ),
            }
            for record in records
        ],
    }


# =========================================================
# STUDENT'S OWN RESULTS
# =========================================================

@router.get("/mine/{job_id}")
def my_coding_results(
    job_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    _require_student(user)
    _job_or_404(db, job_id)

    records = (
        db.query(CodingSubmissionRecord)
        .filter_by(
            job_id=job_id,
            student_id=user.id,
        )
        .order_by(
            CodingSubmissionRecord.submitted_at.desc(),
            CodingSubmissionRecord.id.desc(),
        )
        .all()
    )

    return {
        "job_id": job_id,
        "results": [
            {
                "submission_id": record.id,
                "question_id": record.question_id,
                "language": record.language,
                "score": record.score,
                "passed_tests": record.passed_tests,
                "total_tests": record.total_tests,
                "status": record.status,
                "submitted_at": (
                    record.submitted_at.isoformat()
                    if record.submitted_at else None
                ),
            }
            for record in records
        ],
    }
