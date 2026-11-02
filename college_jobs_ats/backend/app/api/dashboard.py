from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.api.deps import require_roles
from app.db import get_db
from app.models import Application, Job, User

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/stats")
def stats(db: Session = Depends(get_db), user: User = Depends(require_roles("admin", "superadmin", "company", "student"))):
    if user.role == "student":
        return {
            "role": user.role,
            "jobs": db.query(Job).filter(Job.is_active.is_(True)).count(),
            "applications": db.query(Application).filter(Application.student_id == user.id).count(),
            "selected": db.query(Application).filter(Application.student_id == user.id, Application.status == "selected").count(),
        }
    if user.role == "company":
        jobs = db.query(Job).filter(Job.company_id == user.id).count()
        apps = db.query(Application).join(Job).filter(Job.company_id == user.id).count()
        selected = db.query(Application).join(Job).filter(Job.company_id == user.id, Application.status == "selected").count()
        return {"role": user.role, "jobs": jobs, "applications": apps, "selected": selected}

    return {
        "role": user.role,
        "users": db.query(User).count(),
        "students": db.query(User).filter(User.role == "student").count(),
        "companies": db.query(User).filter(User.role == "company").count(),
        "jobs": db.query(Job).count(),
        "applications": db.query(Application).count(),
        "selected": db.query(Application).filter(Application.status == "selected").count(),
    }

@router.get("/users")
def users(db: Session = Depends(get_db), user: User = Depends(require_roles("admin", "superadmin"))):
    rows = db.query(User).order_by(User.created_at.desc()).all()
    return [{"id": x.id, "name": x.name, "email": x.email, "role": x.role, "is_active": x.is_active} for x in rows]

@router.get("/companies")
def companies(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "superadmin"))
):
    rows = (
        db.query(User)
        .filter(User.role == "company")
        .order_by(User.created_at.desc())
        .all()
    )

    return [
        {
            "id": company.id,
            "name": company.name,
            "email": company.email,
            "role": company.role,
            "is_active": company.is_active,
            "is_verified": company.is_verified,
            "created_at": company.created_at,
        }
        for company in rows
    ]