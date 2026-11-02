from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    computed_field,
)


# =========================================================
# AUTHENTICATION
# =========================================================

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str | None = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6)
    role: str = "student"


class VerifyOtpIn(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class ResendOtpIn(BaseModel):
    email: EmailStr


class MessageOut(BaseModel):
    message: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    role: str
    is_verified: bool = False

    # Angular reads `full_name`; the database column is `name`
    @computed_field
    @property
    def full_name(self) -> str:
        return self.name


# =========================================================
# JOBS
# =========================================================

class JobCreate(BaseModel):
    title: str
    description: str
    location: str = ""
    skills: list[str] = []
    salary: str = ""


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_id: int
    title: str
    description: str
    location: str
    skills: str
    salary: str
    is_active: bool
    created_at: datetime


# =========================================================
# APPLICATIONS
# =========================================================


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: int
    student_id: int
    status: str

    # Include the real job position title
    job_title: str | None = None

    resume_filename: str | None = None

    ats_score: float | None = None
    skill_score: float | None = None
    education_score: float | None = None
    experience_score: float | None = None

    ats_recommendation: str | None = None

    matched_skills: str | None = None
    missing_skills: str | None = None
    ats_notes: str | None = None

    created_at: datetime


# ---------- Admin / company list (search + pagination) ----------

class ApplicationRow(BaseModel):
    id: int
    job_id: int
    job_title: str
    student_id: int
    student_name: str
    student_email: str
    status: str
    resume_filename: str | None = None
    ats_score: float | None = None
    skill_score: float | None = None
    education_score: float | None = None
    experience_score: float | None = None
    ats_recommendation: str | None = None
    matched_skills: list[str] = []
    missing_skills: list[str] = []
    ats_notes: str | None = None
    created_at: datetime


class ApplicationPage(BaseModel):
    items: list[ApplicationRow]
    total: int
    page: int
    page_size: int
    pages: int
    status_counts: dict[str, int]