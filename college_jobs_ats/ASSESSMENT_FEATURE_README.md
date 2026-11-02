# 15-question descriptive assessment integration

## What was added
- FastAPI router `app/api/assessment.py`
- SQLAlchemy `assessment_attempts` table (created on startup by existing `Base.metadata.create_all`)
- Student Angular page at `/student/assessment/:jobId`
- Authenticated endpoints for questions, submission, student status and company/admin results

## Run
1. Back up your project and database.
2. Start the FastAPI backend as usual. The new table is created on startup. Existing tables are not dropped.
3. Start Angular as usual (`npm start` or your project's normal command).
4. Sign in as a student and open `/student/assessment/JOB_ID`, replacing `JOB_ID` with an active job ID.
5. Company/admin results endpoint: `GET /api/assessment/job/JOB_ID/results`.

## API
- `GET /api/assessment/{job_id}/questions` — returns the 15 questions for an active job.
- `POST /api/assessment/submit` — JSON body: `{ "job_id": 1, "answers": [{"question_id": 1, "answer": "..."}, ...] }`. Requires 15 non-empty answers.
- `GET /api/assessment/mine/{job_id}` — student's attempt status.
- `GET /api/assessment/job/{job_id}/results` — company owner/admin results.

## Important limitations / next integration step
- Automated marks are a **provisional keyword-coverage estimate**, not semantic grading. Every attempt is marked `pending_review`; companies should review answers before deciding.
- Duplicate attempts are blocked per student/job.
- This change does not automatically submit a job application or change existing application statuses. To enforce “assessment before applying,” connect the existing `POST /api/applications/` endpoint to require a completed assessment, and add a link/button from the student jobs page to `/student/assessment/{job.id}`. That avoids silently changing your existing application flow.
- Questions currently use the same balanced 15-question bank. Job skill text is accepted and the question endpoint is job-scoped; refine question-bank selection as you add more questions per technology.
