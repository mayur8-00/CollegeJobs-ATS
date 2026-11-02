"""In-process ATS engine. No second HTTP service is required."""
import io
import re
from pathlib import Path
from fastapi import HTTPException
from pypdf import PdfReader
from docx import Document

DEFAULT_SKILLS = {
    "python", "django", "fastapi", "flask", "java", "spring boot",
    "javascript", "typescript", "angular", "react", "node.js", "nodejs",
    "html", "css", "bootstrap", "sql", "mysql", "postgresql", "mongodb",
    "git", "github", "docker", "aws", "rest api", "machine learning",
    "data analysis", "pandas", "numpy", "testing", "selenium"
}

EDUCATION_TERMS = [
    "bachelor", "b.tech", "b.e", "bca", "mca", "m.tech", "master",
    "degree", "computer science", "information technology", "engineering"
]
EXPERIENCE_TERMS = [
    "experience", "internship", "developer", "engineer", "software",
    "project", "worked", "employment"
]


def _normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9+#.\- ]+", " ", (value or "").lower())


def _parse_skills(value: str) -> list[str]:
    raw = [x.strip().lower() for x in re.split(r"[,;\n|]+", value or "")]
    return [x for x in raw if x]


def _extract_pdf(data: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(data))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not read PDF: {exc}")


def _extract_docx(data: bytes) -> str:
    try:
        document = Document(io.BytesIO(data))
        return "\n".join(p.text for p in document.paragraphs)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not read DOCX: {exc}")


def extract_resume_text(filename: str, data: bytes) -> str:
    ext = Path(filename or "").suffix.lower()
    if ext == ".pdf":
        text = _extract_pdf(data)
    elif ext == ".docx":
        text = _extract_docx(data)
    else:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX resumes are allowed")
    if not text.strip():
        raise HTTPException(
            status_code=422,
            detail="Could not extract text from the resume. Scanned-image PDFs require OCR."
        )
    return text


def analyze_resume(text: str, job_title: str, job_description: str, job_skills: str) -> dict:
    normalized_text = _normalize(text)
    requested = _parse_skills(job_skills)
    if not requested:
        combined = _normalize(f"{job_title} {job_description}")
        requested = [skill for skill in DEFAULT_SKILLS if skill in combined]

    requested = list(dict.fromkeys(requested))
    matched = [skill for skill in requested if _normalize(skill) in normalized_text]
    missing = [skill for skill in requested if skill not in matched]
    skill_score = round((len(matched) / len(requested)) * 100, 2) if requested else 0.0

    education_score = 100.0 if any(x in normalized_text for x in EDUCATION_TERMS) else 0.0
    experience_score = 100.0 if any(x in normalized_text for x in EXPERIENCE_TERMS) else 0.0
    ats_score = round(skill_score * 0.70 + education_score * 0.15 + experience_score * 0.15, 2)

    if ats_score >= 75:
        recommendation = "Selected"
    elif ats_score >= 50:
        recommendation = "Review"
    else:
        recommendation = "Rejected"

    return {
        "ats_score": ats_score,
        "skill_score": skill_score,
        "education_score": education_score,
        "experience_score": experience_score,
        "recommendation": recommendation,
        "matched_skills": matched,
        "missing_skills": missing,
        "notes": "Automated rule-based screening aid; final hiring decisions remain with authorized users.",
    }
