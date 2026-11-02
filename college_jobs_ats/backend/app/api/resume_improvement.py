
from fastapi import APIRouter, UploadFile, File, HTTPException
from pathlib import Path
import fitz
from docx import Document
from io import BytesIO

router = APIRouter()

MAX_FILE_SIZE = 5 * 1024 * 1024


@router.post("/resume-improvement/analyze")
async def analyze_resume(resume: UploadFile = File(...)):

    extension = Path(resume.filename or "").suffix.lower()

    if extension not in [".pdf", ".docx"]:
        raise HTTPException(
            status_code=400,
            detail="Only PDF and DOCX files are supported."
        )

    content = await resume.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="Resume size must be 5 MB or less."
        )

    try:
        if extension == ".pdf":
            pdf = fitz.open(stream=content, filetype="pdf")
            extracted_text = "\n".join(
                page.get_text() for page in pdf
            )
            pdf.close()

        else:
            document = Document(BytesIO(content))
            extracted_text = "\n".join(
                paragraph.text for paragraph in document.paragraphs
            )

        if not extracted_text.strip():
            raise HTTPException(
                status_code=400,
                detail="No readable text found in the resume."
            )

        return {
            "success": True,
            "filename": resume.filename,
            "message": "Resume uploaded and text extracted successfully.",
            "extracted_text": extracted_text,
            "suggestions": [
                "Add a professional summary.",
                "Highlight technical skills.",
                "Include measurable project achievements.",
                "Mention relevant internship experience."
            ]
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Resume processing failed: {str(error)}"
        )
