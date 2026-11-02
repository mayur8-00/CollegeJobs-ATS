from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import current_user, require_roles
from app.db import get_db
from app.models import Job, User
from app.schemas.schemas import JobCreate, JobOut

router = APIRouter(prefix="/jobs", tags=["Jobs"])

@router.get("/", response_model=list[JobOut])
def list_jobs(
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    query = db.query(Job)
    if user.role == "company":
        query = query.filter(Job.company_id == user.id)
    elif user.role == "student":
        query = query.filter(Job.is_active.is_(True))
    return query.order_by(Job.created_at.desc()).all()

@router.post("/", response_model=JobOut)
def create_job(
    data: JobCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("company", "admin", "superadmin")),
):
    company_id = user.id if user.role == "company" else user.id
    job = Job(
        company_id=company_id,
        title=data.title,
        description=data.description,
        location=data.location,
        skills=", ".join(data.skills),
        salary=data.salary,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job

@router.get("/{job_id}", response_model=JobOut)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.delete("/{job_id}")
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("company", "admin", "superadmin")),
):
    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if user.role == "company" and job.company_id != user.id:
        raise HTTPException(status_code=403, detail="Not your job")
    db.delete(job)
    db.commit()
    return {"message": "Job deleted"}
