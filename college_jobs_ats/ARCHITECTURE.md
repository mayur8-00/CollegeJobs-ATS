# CollegeJobs ATS — Efficient 2-Service Design

## Only two application services

### Service 1 — Angular frontend
- Port: `4200`
- Responsive SPA
- Login and JWT session handling
- Role-specific navigation and route guards
- Student, Company, Admin and Superadmin workspaces

### Service 2 — FastAPI backend
- Port: `8000`
- JWT authentication and RBAC
- MySQL/SQLAlchemy data access
- Job and application APIs
- Resume upload/storage
- ATS extraction + scoring in the same Python process
- Application status workflow

### Database — MySQL
MySQL is the persistent database, not a separate application/API service.

## ATS request flow

```text
Student Angular
     |
     | POST /api/applications/ (multipart)
     | resume + job_id
     v
FastAPI
  |
  +--> Save resume
  |
  +--> Extract PDF/DOCX text
  |
  +--> ATS engine (Python module, same process)
  |       |
  |       +--> skills score
  |       +--> education score
  |       +--> experience score
  |       +--> overall match
  |       +--> matched/missing skills
  |
  +--> Save ATS result in MySQL
  |
  +--> Return application + ATS result
```

There is deliberately **no `ATS_URL`, no HTTP call to port `8001`, and no `ats_service` directory**.
