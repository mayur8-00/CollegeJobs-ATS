# Descriptive assessment integration

The student assessment route and standalone assessment component are already present in this project. The job application success modal is now connected to that route.

## Student flow
1. Sign in with a student account.
2. Open **Student → Jobs**.
3. Choose **Apply now**, upload a PDF/DOCX resume, and submit the application.
4. On success, click **Continue to assessment**.
5. Answer all 15 questions and submit. The UI shows the provisional score and pending company review status.

The student may choose **Do this later** and return to the assessment from `/student/assessment/JOB_ID` (replace `JOB_ID` with the active job's ID).

## Backend
`backend/app/main.py` already imports and includes `app.api.assessment` under `/api`, and startup calls `Base.metadata.create_all()`, which should create `assessment_attempts` provided the assessment model has been imported (it is imported through the assessment router).

Start backend from the `backend` directory with the project's virtual environment active:
```cmd
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Start frontend from `frontend`:
```cmd
npm install
npm start
```

Open `http://localhost:4200`. The assessment is authenticated and intended for student accounts. Provisional marks are keyword-based only and must not be treated as a final hiring decision; the company review remains pending.
