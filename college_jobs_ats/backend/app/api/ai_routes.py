
import requests

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/ai", tags=["Local AI"])

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "llama3.2:3b"


class InterviewRequest(BaseModel):
    job_title: str = Field(min_length=1, max_length=150)
    skills: list[str] = Field(default_factory=list, max_length=30)


@router.post("/interview-questions")
def generate_interview_questions(data: InterviewRequest):
    skills_text = ", ".join(data.skills) or "general role-related skills"

    prompt = f"""
    Generate 5 useful interview questions for a candidate applying
    for the role of {data.job_title}.
    Focus on these skills: {skills_text}.
    Include a mixture of technical and practical questions.
    Return a numbered list.
    """

    try:
        response = requests.post(
            OLLAMA_URL,
            json={
                "model": MODEL_NAME,
                "prompt": prompt,
                "stream": False,
            },
            timeout=180,
        )
        response.raise_for_status()
        result = response.json()

        return {
            "job_title": data.job_title,
            "questions": result.get("response", "").strip(),
            "model": MODEL_NAME,
        }

    except requests.RequestException as exc:
        raise HTTPException(
            status_code=503,
            detail="Local AI service is unavailable. Check that Ollama is running.",
        ) from exc
