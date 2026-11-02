import json
from math import ceil
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
)
from fastapi.responses import FileResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api.deps import current_user, require_roles
from app.core.config import UPLOAD_DIR
from app.db import get_db
from app.models import Application, Job, User
from app.schemas.schemas import (
    ApplicationOut,
    ApplicationPage,
    ApplicationRow,
)
from app.services.ats_engine import (
    analyze_resume,
    extract_resume_text,
)


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/applications",
    tags=["Applications"],
)


# ============================================================
# CONFIGURATION
# ============================================================

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".docx",
}

MAX_FILE_SIZE = 5 * 1024 * 1024

VALID_STATUSES = {
    "applied",
    "reviewing",
    "shortlisted",
    "selected",
    "rejected",
}


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def _to_list(value: str | None) -> list[str]:
    """
    Convert JSON stored skills into a normal Python list.

    Database example:
        '["Python", "FastAPI", "Django"]'

    Returns:
        ["Python", "FastAPI", "Django"]
    """

    if not value:
        return []

    try:
        data = json.loads(value)

        if isinstance(data, list):
            return [str(item) for item in data]

        return [str(data)]

    except Exception:
        return [
            item.strip()
            for item in str(value).split(",")
            if item.strip()
        ]


def _status_counts(query):
    """
    Return counts for all application statuses.

    This guarantees that the frontend always receives:

        all
        applied
        reviewing
        shortlisted
        selected
        rejected
    """

    rows = (
        query.with_entities(
            Application.status,
            func.count(Application.id),
        )
        .group_by(Application.status)
        .all()
    )

    counts = {
        "all": 0,
        "applied": 0,
        "reviewing": 0,
        "shortlisted": 0,
        "selected": 0,
        "rejected": 0,
    }

    for status, count in rows:
        if status:
            status_key = str(status).lower()

            if status_key in counts:
                counts[status_key] = count

            counts["all"] += count

    return counts


# ============================================================
# STUDENT - APPLY FOR JOB
# ============================================================

@router.post(
    "/",
    response_model=ApplicationOut,
)
async def apply_job(
    job_id: int = Form(...),
    resume: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("student")),
):
    """
    Student applies for a specific job.

    Student ID comes from the authenticated JWT.

    A student cannot apply to the same job more than once.
    """

    # --------------------------------------------------------
    # FIND JOB
    # --------------------------------------------------------

    job = db.get(Job, job_id)

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Job not found",
        )

    if not job.is_active:
        raise HTTPException(
            status_code=404,
            detail="Active job not found",
        )

    # --------------------------------------------------------
    # DUPLICATE APPLICATION CHECK
    # --------------------------------------------------------

    existing = (
        db.query(Application)
        .filter(
            Application.job_id == job.id,
            Application.student_id == user.id,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="You already applied to this job",
        )

    # --------------------------------------------------------
    # VALIDATE RESUME
    # --------------------------------------------------------

    original_filename = Path(
        resume.filename or "resume"
    ).name

    extension = Path(
        original_filename
    ).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Only PDF and DOCX resumes are allowed",
        )

    content = await resume.read()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Resume file is empty",
        )

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="Resume must be 5 MB or smaller",
        )

    # --------------------------------------------------------
    # SAVE RESUME
    # --------------------------------------------------------

    UPLOAD_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    safe_filename = original_filename.replace(
        " ",
        "_",
    )

    safe_name = (
        f"student_{user.id}"
        f"_job_{job.id}"
        f"_{safe_filename}"
    )

    path = UPLOAD_DIR / safe_name

    path.write_bytes(content)

    # --------------------------------------------------------
    # CREATE APPLICATION
    # --------------------------------------------------------

    application = Application(
        job_id=job.id,
        student_id=user.id,
        status="applied",
        resume_filename=original_filename,
        resume_path=str(path),
    )

    db.add(application)

    try:
        db.commit()
        db.refresh(application)

    except Exception as exc:
        db.rollback()

        print(
            "ERROR while creating application:",
            exc,
        )

        try:
            if path.exists():
                path.unlink()
        except Exception:
            pass

        raise HTTPException(
            status_code=500,
            detail="Failed to create application",
        )

    # --------------------------------------------------------
    # ATS ANALYSIS
    # --------------------------------------------------------

    try:
        resume_text = extract_resume_text(
            original_filename,
            content,
        )

        result = analyze_resume(
            resume_text,
            job.title,
            job.description,
            job.skills,
        )

        application.ats_score = result.get(
            "ats_score"
        )

        application.skill_score = result.get(
            "skill_score"
        )

        application.education_score = result.get(
            "education_score"
        )

        application.experience_score = result.get(
            "experience_score"
        )

        application.ats_recommendation = result.get(
            "recommendation"
        )

        application.matched_skills = json.dumps(
            result.get(
                "matched_skills",
                [],
            )
        )

        application.missing_skills = json.dumps(
            result.get(
                "missing_skills",
                [],
            )
        )

        application.ats_notes = result.get(
            "notes"
        )

        db.commit()
        db.refresh(application)

    except HTTPException as exc:

        print(
            "ATS analysis failed:",
            exc.detail,
        )

        application.ats_notes = (
            f"ATS analysis failed: {exc.detail}"
        )

        db.commit()
        db.refresh(application)

    except Exception as exc:

        print(
            "Unexpected ATS error:",
            exc,
        )

        application.ats_notes = (
            f"ATS analysis failed: {str(exc)}"
        )

        db.commit()
        db.refresh(application)

    return application


# ============================================================
# VIEW RESUME
# ============================================================

@router.get(
    "/{application_id}/resume"
)
def view_resume(
    application_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """
    Student:
        Can view own resume.

    Company:
        Can view resumes belonging to its own jobs.

    Admin/Superadmin:
        Can view all resumes.
    """

    application = db.get(
        Application,
        application_id,
    )

    if not application:
        raise HTTPException(
            status_code=404,
            detail="Application not found",
        )

    if not application.resume_path:
        raise HTTPException(
            status_code=404,
            detail="Resume not found",
        )

    # --------------------------------------------------------
    # STUDENT ACCESS
    # --------------------------------------------------------

    if (
        user.role == "student"
        and application.student_id != user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="Not your application",
        )

    # --------------------------------------------------------
    # COMPANY ACCESS
    # --------------------------------------------------------

    if user.role == "company":

        if (
            not application.job
            or application.job.company_id != user.id
        ):
            raise HTTPException(
                status_code=403,
                detail="Not your application",
            )

    # --------------------------------------------------------
    # CHECK FILE
    # --------------------------------------------------------

    path = Path(
        application.resume_path
    )

    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail="Resume file no longer exists",
        )

    suffix = path.suffix.lower()

    if suffix == ".pdf":

        media_type = "application/pdf"

        disposition = "inline"

    else:

        media_type = (
            "application/"
            "vnd.openxmlformats-officedocument."
            "wordprocessingml.document"
        )

        disposition = "attachment"

    return FileResponse(
        path=str(path),
        filename=(
            application.resume_filename
            or path.name
        ),
        media_type=media_type,
        content_disposition_type=disposition,
    )


# ============================================================
# STUDENT - MY APPLICATIONS
# ============================================================


@router.get(
    "/mine",
    response_model=list[ApplicationOut],
)
def my_applications(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("student")),
):
    """
    Return the logged-in student's applications,
    including the actual job position title and ATS results.
    """

    rows = (
        db.query(Application, Job.title)
        .join(Job, Application.job_id == Job.id)
        .filter(Application.student_id == user.id)
        .order_by(Application.created_at.desc())
        .all()
    )

    results = []

    for application, job_title in rows:
        results.append(
            ApplicationOut(
                id=application.id,
                job_id=application.job_id,
                student_id=application.student_id,
                status=application.status,
                job_title=job_title,
                resume_filename=application.resume_filename,
                ats_score=application.ats_score,
                skill_score=application.skill_score,
                education_score=application.education_score,
                experience_score=application.experience_score,
                ats_recommendation=application.ats_recommendation,
                matched_skills=application.matched_skills,
                missing_skills=application.missing_skills,
                ats_notes=application.ats_notes,
                created_at=application.created_at,
            )
        )

    return results


# ============================================================
# COMPANY / ADMIN / SUPERADMIN
# OLD APPLICATION LIST
# ============================================================

@router.get(
    "/company",
    response_model=list[ApplicationOut],
)
def company_applications(
    db: Session = Depends(get_db),
    user: User = Depends(
        require_roles(
            "company",
            "admin",
            "superadmin",
        )
    ),
):
    """
    Existing endpoint kept for compatibility.

    Company:
        Only own job applications.

    Admin/Superadmin:
        All applications.
    """

    query = (
        db.query(Application)
        .join(Job)
    )

    if user.role == "company":

        query = query.filter(
            Job.company_id == user.id
        )

    return (
        query
        .order_by(
            Application.created_at.desc()
        )
        .all()
    )


# ============================================================
# SEARCH / FILTER / PAGINATION
# COMPANY / ADMIN / SUPERADMIN
# ============================================================

@router.get(
    "/search",
    response_model=ApplicationPage,
)
def search_applications(
    q: str | None = None,

    status_filter: str | None = Query(
        None,
        alias="status",
    ),

    recommendation: str | None = None,

    job_id: int | None = None,

    min_score: float | None = Query(
        None,
        ge=0,
        le=100,
    ),

    sort: str = Query(
        "newest"
    ),

    page: int = Query(
        1,
        ge=1,
    ),

    page_size: int = Query(
        20,
        ge=5,
        le=100,
    ),

    db: Session = Depends(get_db),

    user: User = Depends(
        require_roles(
            "company",
            "admin",
            "superadmin",
        )
    ),
):

    # ========================================================
    # BASE QUERY
    # ========================================================

    base = (
        db.query(
            Application,
            User,
            Job,
        )
        .join(
            User,
            Application.student_id == User.id,
        )
        .join(
            Job,
            Application.job_id == Job.id,
        )
    )

    # ========================================================
    # COMPANY SECURITY
    # ========================================================

    if user.role == "company":

        base = base.filter(
            Job.company_id == user.id
        )

    # ========================================================
    # SEARCH
    # ========================================================

    if q and q.strip():

        search_term = q.strip()

        term = f"%{search_term}%"

        conditions = [
            User.name.ilike(term),
            User.email.ilike(term),
            Job.title.ilike(term),
            Application.resume_filename.ilike(term),
        ]

        # Search Application ID
        if search_term.isdigit():

            conditions.append(
                Application.id
                == int(search_term)
            )

            conditions.append(
                Application.student_id
                == int(search_term)
            )

            conditions.append(
                Application.job_id
                == int(search_term)
            )

        base = base.filter(
            or_(*conditions)
        )

    # ========================================================
    # RECOMMENDATION FILTER
    # ========================================================

    if recommendation:

        base = base.filter(
            func.lower(
                Application.ats_recommendation
            )
            ==
            recommendation.strip().lower()
        )

    # ========================================================
    # JOB FILTER
    # ========================================================

    if job_id:

        base = base.filter(
            Application.job_id == job_id
        )

    # ========================================================
    # MINIMUM ATS SCORE
    # ========================================================

    if min_score is not None:

        base = base.filter(
            Application.ats_score >= min_score
        )

    # ========================================================
    # STATUS COUNTS
    #
    # Counts are calculated BEFORE status filter.
    # This makes the UI tabs useful.
    # ========================================================

    status_counts = _status_counts(
        base
    )

    # ========================================================
    # STATUS FILTER
    # ========================================================

    if (
        status_filter
        and status_filter.lower() != "all"
    ):

        normalized_status = (
            status_filter
            .strip()
            .lower()
        )

        if normalized_status not in VALID_STATUSES:

            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid application status"
                ),
            )

        base = base.filter(
            Application.status
            == normalized_status
        )

    # ========================================================
    # TOTAL RESULTS
    # ========================================================

    total = (
        base.with_entities(
            func.count(Application.id)
        )
        .scalar()
        or 0
    )

    # ========================================================
    # SORTING
    # ========================================================

    score = func.coalesce(
        Application.ats_score,
        -1,
    )

    sort_options = {

        "newest":
            Application.created_at.desc(),

        "oldest":
            Application.created_at.asc(),

        "score_high":
            score.desc(),

        "score_low":
            score.asc(),
    }

    order = sort_options.get(
        sort,
        Application.created_at.desc(),
    )

    # ========================================================
    # PAGINATION
    # ========================================================

    offset = (
        (page - 1)
        * page_size
    )

    rows = (
        base
        .order_by(
            order,
            Application.id.desc(),
        )
        .offset(offset)
        .limit(page_size)
        .all()
    )

    # ========================================================
    # CONVERT DATABASE ROWS
    # TO FRONTEND RESPONSE
    # ========================================================

    items = []

    for application, student, job in rows:

        item = ApplicationRow(

            id=application.id,

            job_id=application.job_id,

            job_title=job.title,

            student_id=application.student_id,

            student_name=student.name,

            student_email=student.email,

            status=application.status,

            resume_filename=(
                application.resume_filename
            ),

            ats_score=(
                application.ats_score
            ),

            skill_score=(
                application.skill_score
            ),

            education_score=(
                application.education_score
            ),

            experience_score=(
                application.experience_score
            ),

            ats_recommendation=(
                application.ats_recommendation
            ),

            matched_skills=_to_list(
                application.matched_skills
            ),

            missing_skills=_to_list(
                application.missing_skills
            ),

            ats_notes=(
                application.ats_notes
            ),

            created_at=(
                application.created_at
            ),
        )

        items.append(item)

    # ========================================================
    # TOTAL PAGES
    # ========================================================

    total_pages = max(
        1,
        ceil(
            total / page_size
        ),
    )

    # ========================================================
    # RESPONSE
    # ========================================================

    return ApplicationPage(

        items=items,

        total=total,

        page=page,

        page_size=page_size,

        pages=total_pages,

        status_counts=status_counts,
    )


# ============================================================
# UPDATE APPLICATION STATUS
# ============================================================

@router.patch(
    "/{application_id}/status",
    response_model=ApplicationOut,
)
def update_status(
    application_id: int,

    new_status: str = Form(...),

    db: Session = Depends(get_db),

    user: User = Depends(
        require_roles(
            "company",
            "admin",
            "superadmin",
        )
    ),
):

    # ========================================================
    # NORMALIZE STATUS
    # ========================================================

    new_status = (
        new_status
        .strip()
        .lower()
    )

    # ========================================================
    # VALIDATE STATUS
    # ========================================================

    if new_status not in VALID_STATUSES:

        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid application status. "
                "Allowed values: "
                "applied, reviewing, shortlisted, "
                "selected, rejected"
            ),
        )

    # ========================================================
    # FIND APPLICATION
    # ========================================================

    application = db.get(
        Application,
        application_id,
    )

    if not application:

        raise HTTPException(
            status_code=404,
            detail="Application not found",
        )

    # ========================================================
    # COMPANY SECURITY
    # ========================================================

    if user.role == "company":

        if (
            not application.job
            or application.job.company_id
            != user.id
        ):

            raise HTTPException(
                status_code=403,
                detail="Not your application",
            )

    # ========================================================
    # UPDATE
    # ========================================================

    application.status = new_status

    db.commit()

    db.refresh(application)

    return application