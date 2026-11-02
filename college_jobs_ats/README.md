# CollegeJobs ATS — 2-Service Architecture

## Architecture

```text
Angular Frontend :4200
        |
        | REST / JWT / multipart resume upload
        v
FastAPI Backend :8000
        |
        +-- Authentication + RBAC
        +-- Jobs + Applications
        +-- Resume storage
        +-- ATS extraction + scoring (in-process)
        |
        v
MySQL :3306
```

There are **two application services only**: Angular and FastAPI. The ATS is a Python module inside FastAPI, so resume analysis does not require a third HTTP server or port 8001.

## Roles
- Superadmin: full access
- Admin: users, jobs, applications and operational dashboard
- Company: own jobs, candidate applications and ATS results
- Student: active jobs, resume upload, applications and ATS results

## Demo accounts
- superadmin@collegejobs.com / Admin@123
- admin@collegejobs.com / Admin@123
- company@collegejobs.com / Company@123
- student@collegejobs.com / Student@123

## Backend
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
# create MySQL database college_jobs and configure .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Swagger: http://localhost:8000/docs

## Frontend
```powershell
cd frontend
npm install
npm start
```

Open http://localhost:4200

## ATS flow
1. Student uploads PDF/DOCX for a job.
2. FastAPI saves the resume.
3. FastAPI extracts resume text with pypdf/python-docx.
4. The in-process ATS calculates skill, education, experience and weighted match scores.
5. Results are stored on the application in MySQL.
6. Company/Admin/Superadmin can review the ATS result and change application status.

Scanned-image PDFs need OCR if they contain no selectable text.
