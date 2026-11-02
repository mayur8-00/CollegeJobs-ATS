import json
import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.db import Base, get_db
from app.models import Job, User


router = APIRouter(
    prefix="/assessment",
    tags=["Descriptive Assessment"],
)


class AssessmentAttempt(Base):
    __tablename__ = "assessment_attempts"
    __table_args__ = (
        UniqueConstraint(
            "student_id",
            "job_id",
            name="uq_assessment_student_job",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    job_id = Column(
        Integer,
        ForeignKey("jobs.id"),
        nullable=False,
        index=True,
    )
    answers_json = Column(Text, nullable=False)
    score = Column(Integer, nullable=False, default=0)
    max_score = Column(Integer, nullable=False, default=75)
    review_status = Column(
        Text,
        nullable=False,
        default="pending_review",
    )
    submitted_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )


# Each question bank entry contains:
# category, question, expected scoring concepts.

FRONTEND_QUESTIONS = [
    ("Frontend", "Explain semantic HTML and why it improves accessibility.", ["html", "semantic", "accessibility"]),
    ("CSS", "Explain the CSS box model and how margin, padding and border work.", ["css", "margin", "padding", "border"]),
    ("Responsive Design", "How would you build a responsive website for mobile and desktop?", ["responsive", "media query", "flexbox", "grid"]),
    ("JavaScript", "Explain let, const and var in JavaScript.", ["let", "const", "var", "scope"]),
    ("JavaScript", "Explain promises and async/await with an example.", ["promise", "async", "await"]),
    ("JavaScript", "How do you handle errors when calling an API from JavaScript?", ["api", "error", "catch", "response"]),
    ("Angular", "Explain components, templates and data binding in Angular.", ["angular", "component", "template", "binding"]),
    ("Angular", "What are services and dependency injection in Angular?", ["service", "dependency injection", "inject"]),
    ("React", "Explain components, props and state in React.", ["react", "component", "props", "state"]),
    ("REST API", "How does a frontend application send requests to a REST API?", ["http", "request", "response", "json"]),
    ("Forms", "How would you validate a form before submitting it?", ["validation", "required", "input", "error"]),
    ("Browser", "How do you investigate a frontend error using browser developer tools?", ["console", "network", "debug", "error"]),
    ("Performance", "Describe ways to improve frontend page loading performance.", ["performance", "lazy loading", "cache", "optimize"]),
    ("Git", "How do Git branches and pull requests support frontend teamwork?", ["git", "branch", "commit", "pull request"]),
    ("Project Experience", "Describe a frontend project you built and a difficult issue you solved.", ["project", "challenge", "solution", "result"]),
]

DOTNET_QUESTIONS = [
    ("C#", "Explain value types and reference types in C# with examples.", ["value type", "reference type", "memory", "object"]),
    ("C# / OOP", "Explain encapsulation, inheritance, polymorphism and abstraction in C#.", ["encapsulation", "inheritance", "polymorphism", "abstraction"]),
    (".NET Runtime", "What is the CLR and how does it execute managed code?", ["clr", "runtime", "managed code", "garbage collection"]),
    ("ASP.NET Core", "Explain middleware and the HTTP request pipeline in ASP.NET Core.", ["middleware", "request", "response", "pipeline"]),
    ("Web API", "How would you design a REST API endpoint in ASP.NET Core and return appropriate status codes?", ["http", "endpoint", "status code", "validation"]),
    ("Entity Framework Core", "What is Entity Framework Core, and how do migrations manage a database schema?", ["orm", "entity framework", "migration", "database"]),
    ("SQL Server", "Explain primary keys, foreign keys and joins in a relational database.", ["primary key", "foreign key", "join", "relational"]),
    ("LINQ", "What is LINQ, and how would you filter and sort a collection with it?", ["linq", "where", "orderby", "collection"]),
    ("Security", "How would you secure an ASP.NET Core API using authentication and authorization?", ["authentication", "authorization", "token", "policy"]),
    ("Dependency Injection", "Explain dependency injection and service lifetimes in .NET.", ["dependency injection", "service", "scoped", "singleton"]),
    ("Async C#", "Explain async and await and why asynchronous code is useful in web applications.", ["async", "await", "task", "non-blocking"]),
    ("Error Handling", "How would you handle exceptions and log application errors in .NET?", ["exception", "try", "catch", "logging"]),
    ("Testing", "How would you unit test a .NET service and isolate its dependencies?", ["unit test", "mock", "assert", "dependency"]),
    ("Architecture", "How would you separate controllers, business logic and data access in a maintainable .NET application?", ["controller", "service", "repository", "separation"]),
    ("Project Experience", "Describe a software project you built, your contribution, a technical challenge and its solution.", ["project", "contribution", "challenge", "solution"]),
]

PYTHON_QUESTIONS = [
    ("Python", "Explain the differences between lists, tuples, sets and dictionaries.", ["list", "tuple", "set", "dictionary"]),
    ("Python", "Explain exception handling and the purpose of try, except and finally.", ["try", "except", "finally", "exception"]),
    ("Python", "What are decorators and generators in Python, and when would you use them?", ["decorator", "generator", "yield", "function"]),
    ("Django / FastAPI", "Compare Django and FastAPI and explain when you would choose each.", ["django", "fastapi", "framework", "api"]),
    ("REST API", "Describe how you would implement a secure registration endpoint in a Python REST API.", ["validate", "password", "hash", "database"]),
    ("API Validation", "How do request validation and response schemas improve a FastAPI application?", ["validation", "pydantic", "request", "response"]),
    ("HTTP", "Explain how a frontend sends a request to a backend API and handles errors.", ["http", "request", "response", "status code"]),
    ("Database", "Compare SQL and NoSQL and explain when MySQL or MongoDB may be suitable.", ["sql", "nosql", "relational", "document"]),
    ("Database", "How would you prevent duplicate applications for the same student and job?", ["duplicate", "unique", "constraint", "database"]),
    ("Security", "How would you protect login credentials and restrict access by user role?", ["hash", "token", "authentication", "authorization"]),
    ("Git", "Explain how Git branches, commits and pull requests support team collaboration.", ["git", "branch", "commit", "pull request"]),
    ("Deployment", "How would you package and deploy a Python backend with Docker?", ["docker", "image", "container", "dependency"]),
    ("Testing", "How would you test an API endpoint and investigate an incorrect response?", ["test", "pytest", "status", "logs"]),
    ("Architecture", "How would you organize routes, schemas, models and services in a maintainable backend?", ["routes", "schemas", "models", "services"]),
    ("Project Experience", "Describe a Python project you built, your contribution, a technical challenge and its solution.", ["project", "contribution", "challenge", "solution"]),
]

ANGULAR_QUESTIONS = [
    ("TypeScript", "Explain interfaces, types and classes in TypeScript and when you use them.", ["interface", "type", "class", "typescript"]),
    ("Components", "Explain Angular components, templates and component data binding.", ["component", "template", "binding", "property"]),
    ("Services / DI", "What are Angular services and dependency injection, and how do they help reuse code?", ["service", "dependency injection", "inject", "reuse"]),
    ("Routing", "How do Angular routes, route parameters and router navigation work?", ["route", "parameter", "router", "navigation"]),
    ("Forms", "Compare template-driven and reactive forms in Angular.", ["template-driven", "reactive forms", "validation", "formcontrol"]),
    ("HTTP", "How do you call a REST API using Angular HttpClient and handle errors?", ["httpclient", "request", "subscribe", "error"]),
    ("RxJS", "Explain Observables and how subscribe, map or switchMap are used in Angular.", ["observable", "subscribe", "map", "switchmap"]),
    ("Change Detection", "What is Angular change detection and when might OnPush be useful?", ["change detection", "onpush", "component", "update"]),
    ("Directives", "Explain structural and attribute directives with Angular examples.", ["structural", "attribute", "ngif", "ngfor"]),
    ("Guards", "How would you protect Angular routes based on a user's role?", ["guard", "role", "authentication", "authorization"]),
    ("State", "How would you share state between Angular components?", ["service", "state", "observable", "input"]),
    ("Performance", "How would you improve loading performance of a large Angular application?", ["lazy loading", "bundle", "change detection", "trackby"]),
    ("Testing", "How would you unit test an Angular component that calls a service?", ["test", "mock", "service", "assert"]),
    ("Responsive UI", "How would you build an accessible responsive UI using HTML, CSS and Bootstrap?", ["html", "css", "responsive", "accessibility"]),
    ("Project Experience", "Describe an Angular project, your contribution, a technical challenge and your solution.", ["project", "contribution", "challenge", "solution"]),
]

JAVA_QUESTIONS = [
    ("Java", "Explain the difference between an interface and an abstract class in Java.", ["interface", "abstract class", "implementation", "inheritance"]),
    ("OOP", "Explain encapsulation, inheritance, polymorphism and abstraction with Java examples.", ["encapsulation", "inheritance", "polymorphism", "abstraction"]),
    ("Collections", "Compare List, Set and Map in the Java Collections Framework.", ["list", "set", "map", "collection"]),
    ("Exceptions", "Compare checked and unchecked exceptions and explain exception handling.", ["checked", "unchecked", "try", "catch"]),
    ("Spring Boot", "How does Spring Boot auto-configuration help create applications?", ["spring boot", "auto-configuration", "starter", "configuration"]),
    ("REST API", "How would you implement a REST endpoint using Spring Boot?", ["controller", "endpoint", "http", "status"]),
    ("Dependency Injection", "Explain dependency injection and inversion of control in Spring.", ["dependency injection", "inversion of control", "bean", "container"]),
    ("JPA / Hibernate", "What are JPA and Hibernate, and how do they map objects to database tables?", ["jpa", "hibernate", "entity", "orm"]),
    ("SQL", "Explain joins, indexes and transactions in relational databases.", ["join", "index", "transaction", "database"]),
    ("Security", "How would you secure a Spring Boot API and protect endpoints by role?", ["authentication", "authorization", "token", "role"]),
    ("Concurrency", "Explain threads and synchronization in Java.", ["thread", "synchronization", "concurrent", "shared"]),
    ("Streams", "How do Java streams filter, transform and collect data?", ["stream", "filter", "map", "collect"]),
    ("Testing", "How would you unit test a Spring service using JUnit and Mockito?", ["junit", "mockito", "assert", "unit test"]),
    ("Architecture", "How would you separate controller, service and repository layers in Spring Boot?", ["controller", "service", "repository", "layer"]),
    ("Project Experience", "Describe a Java project, your contribution, a technical challenge and its solution.", ["project", "contribution", "challenge", "solution"]),
]

WEB_QUESTIONS = [
    ("HTML", "Explain semantic HTML and how it improves accessibility.", ["semantic", "html", "accessibility", "elements"]),
    ("CSS", "Explain the CSS box model and how Flexbox or Grid helps with layout.", ["box model", "flexbox", "grid", "layout"]),
    ("JavaScript", "Explain let, const, scope and closures in JavaScript.", ["let", "const", "scope", "closure"]),
    ("DOM", "How does JavaScript update the DOM in response to user actions?", ["dom", "event", "listener", "update"]),
    ("Responsive UI", "How would you create a responsive page for mobile and desktop screens?", ["media query", "responsive", "viewport", "flexbox"]),
    ("HTTP", "Explain HTTP methods and common response status codes.", ["get", "post", "put", "status code"]),
    ("REST API", "How should a frontend call a REST API and display loading and error states?", ["request", "response", "loading", "error"]),
    ("Security", "Explain XSS and how to reduce common web application security risks.", ["xss", "sanitize", "escape", "security"]),
    ("Performance", "How would you improve website performance and reduce initial load time?", ["minify", "cache", "lazy loading", "bundle"]),
    ("Accessibility", "How would you make a form usable with a keyboard and screen reader?", ["keyboard", "label", "focus", "screen reader"]),
    ("Forms", "How would you validate user input on the client and server?", ["validation", "client", "server", "sanitize"]),
    ("Git", "Explain how branches and pull requests help teams maintain frontend code.", ["branch", "commit", "pull request", "review"]),
    ("Testing", "How would you test interactive UI behavior and API integration?", ["test", "assert", "mock", "integration"]),
    ("Browser", "Explain local storage, session storage and cookies, including security trade-offs.", ["local storage", "session storage", "cookie", "security"]),
    ("Project Experience", "Describe a web project, your contribution, a technical challenge and your solution.", ["project", "contribution", "challenge", "solution"]),
]

GENERIC_QUESTIONS = [
    ("Programming", "Describe how you break down a programming problem before implementing a solution.", ["requirements", "steps", "algorithm", "test"]),
    ("Debugging", "Explain your process for reproducing, diagnosing and fixing a software bug.", ["reproduce", "logs", "debug", "test"]),
    ("API", "Explain how a client and server communicate through an API.", ["request", "response", "http", "status"]),
    ("Database", "Explain how primary keys and constraints help maintain database integrity.", ["primary key", "constraint", "integrity", "duplicate"]),
    ("Security", "How would you protect sensitive data and restrict access to features?", ["authentication", "authorization", "validation", "security"]),
    ("Testing", "Explain unit testing and integration testing with examples.", ["unit test", "integration test", "mock", "assert"]),
    ("Version Control", "How do commits, branches and code reviews support collaborative development?", ["commit", "branch", "review", "merge"]),
    ("Performance", "How would you investigate and improve a slow application endpoint?", ["measure", "logs", "database", "cache"]),
    ("Deployment", "What checks would you perform before deploying a change to production?", ["test", "environment", "rollback", "monitor"]),
    ("Design", "How would you structure an application to keep responsibilities separate?", ["separation", "service", "module", "responsibility"]),
    ("Data Validation", "Why should input be validated on the server even when the frontend validates it?", ["server", "validation", "trust", "security"]),
    ("Documentation", "What technical information should API documentation include?", ["endpoint", "parameters", "response", "errors"]),
    ("Collaboration", "How would you handle a code review comment that you disagree with?", ["explain", "evidence", "discussion", "team"]),
    ("Problem Solving", "Describe how you compare alternative technical solutions before choosing one.", ["requirements", "trade-off", "cost", "maintainability"]),
    ("Project Experience", "Describe a project, your contribution, a technical challenge and the result.", ["project", "contribution", "challenge", "result"]),
]


def _normalize(value: str) -> str:
    value = (value or "").lower()
    value = value.replace(".net framework", " dotnet ")
    value = value.replace(".net", " dotnet ")
    value = value.replace("c#", " csharp ")
    value = value.replace("c sharp", " csharp ")
    return re.sub(r"\s+", " ", value).strip()


def _question_bank(job: Job):
    title = _normalize(job.title or "")
    skills = _normalize(job.skills or "")
    description = _normalize(job.description or "")
    title_skills = f"{title} {skills}"
    raw = f"{title_skills} {description}"

    # Prefer the job title and skills over unrelated description keywords.
    if any(term in title_skills for term in (
        "dotnet", "csharp", "asp.net", "aspnet",
        "entity framework", "sql server",
    )):
        return DOTNET_QUESTIONS

    if any(term in title_skills for term in ("angular", "typescript")):
        return ANGULAR_QUESTIONS

    if any(term in title_skills for term in (
        "spring boot", "springboot", "java developer", "java engineer",
    )) or title.strip() == "java":
        return JAVA_QUESTIONS

    if any(term in title_skills for term in (
        "data analyst", "data scientist", "data analysis",
        "pandas", "numpy", "machine learning",
    )):
        return PYTHON_QUESTIONS if "python developer" in title_skills else GENERIC_QUESTIONS

    if any(term in title_skills for term in ("python", "django", "fastapi", "flask")):
        return PYTHON_QUESTIONS

    if any(term in title_skills for term in (
        "frontend", "front end", "web developer", "javascript",
        "react", "html", "css",
    )):
        return WEB_QUESTIONS

    # Fallback to description only if title and skills did not decide.
    if any(term in raw for term in ("dotnet", "csharp", "asp.net", "aspnet")):
        return DOTNET_QUESTIONS
    if any(term in raw for term in ("angular", "typescript")):
        return ANGULAR_QUESTIONS
    if any(term in raw for term in ("spring boot", "java")):
        return JAVA_QUESTIONS
    if any(term in raw for term in ("python", "django", "fastapi", "flask")):
        return PYTHON_QUESTIONS

    return GENERIC_QUESTIONS


def select_questions(job: Job):
    bank = _question_bank(job)
    return [
        {
            "id": index,
            "category": category,
            "question": question,
            "marks": 5,
        }
        for index, (category, question, _keywords) in enumerate(bank[:15], start=1)
    ]


class AnswerIn(BaseModel):
    question_id: int = Field(ge=1, le=15)
    answer: str = Field(max_length=10000)


class SubmissionIn(BaseModel):
    job_id: int = Field(gt=0)
    answers: list[AnswerIn] = Field(min_length=15, max_length=15)


@router.get("/{job_id}/questions")
def get_questions(
    job_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    if user.role != "student":
        raise HTTPException(
            status_code=403,
            detail="Only students can take assessments",
        )

    job = db.query(Job).filter(
        Job.id == job_id,
        Job.is_active.is_(True),
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Active job not found")

    prior = db.query(AssessmentAttempt).filter_by(
        student_id=user.id,
        job_id=job_id,
    ).first()

    if prior:
        raise HTTPException(
            status_code=409,
            detail="You have already submitted the assessment for this job",
        )

    return {
        "job_id": job.id,
        "job_title": job.title,
        "total_marks": 75,
        "questions": select_questions(job),
    }


@router.post("/submit")
def submit_assessment(
    payload: SubmissionIn,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    if user.role != "student":
        raise HTTPException(
            status_code=403,
            detail="Only students can submit assessments",
        )

    job = db.query(Job).filter(
        Job.id == payload.job_id,
        Job.is_active.is_(True),
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Active job not found")

    question_ids = [answer.question_id for answer in payload.answers]

    if len(set(question_ids)) != 15 or set(question_ids) != set(range(1, 16)):
        raise HTTPException(
            status_code=422,
            detail="Submit exactly one answer for each of the 15 questions",
        )

    if any(not answer.answer.strip() for answer in payload.answers):
        raise HTTPException(
            status_code=422,
            detail="Please answer all 15 questions before submitting",
        )

    prior = db.query(AssessmentAttempt).filter_by(
        student_id=user.id,
        job_id=payload.job_id,
    ).first()

    if prior:
        raise HTTPException(
            status_code=409,
            detail="Assessment already submitted for this job",
        )

    bank = _question_bank(job)
    score = 0
    details = []

    for answer in payload.answers:
        category, _question, expected = bank[answer.question_id - 1]
        normalized_answer = _normalize(answer.answer)

        matched_terms = [
            term
            for term in expected
            if _normalize(term) in normalized_answer
        ]

        matched_count = len(matched_terms)
        marks = min(
            5,
            round(5 * matched_count / max(1, min(4, len(expected)))),
        )

        score += marks

        details.append({
            "question_id": answer.question_id,
            "category": category,
            "provisional_marks": marks,
            "max_marks": 5,
            "matched_concepts": matched_count,
        })

    attempt = AssessmentAttempt(
        student_id=user.id,
        job_id=payload.job_id,
        answers_json=json.dumps([
            answer.model_dump() for answer in payload.answers
        ]),
        score=score,
        max_score=75,
        review_status="pending_review",
    )

    db.add(attempt)

    try:
        db.commit()
        db.refresh(attempt)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Assessment already submitted for this job",
        )

    return {
        "message": "Assessment submitted for company review",
        "attempt_id": attempt.id,
        "provisional_score": score,
        "max_score": 75,
        "review_status": attempt.review_status,
        "question_scores": details,
    }


@router.get("/mine/{job_id}")
def my_assessment(
    job_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    attempt = db.query(AssessmentAttempt).filter_by(
        student_id=user.id,
        job_id=job_id,
    ).first()

    if not attempt:
        return {"submitted": False}

    return {
        "submitted": True,
        "attempt_id": attempt.id,
        "score": attempt.score,
        "max_score": attempt.max_score,
        "review_status": attempt.review_status,
        "submitted_at": attempt.submitted_at,
    }


@router.get("/job/{job_id}/results")
def job_results(
    job_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    if user.role not in {"company", "admin", "superadmin"}:
        raise HTTPException(
            status_code=403,
            detail="Company or admin role required",
        )

    job = db.query(Job).filter(Job.id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if user.role == "company" and job.company_id != user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only view assessments for your own jobs",
        )

    rows = (
        db.query(AssessmentAttempt, User)
        .join(User, User.id == AssessmentAttempt.student_id)
        .filter(AssessmentAttempt.job_id == job_id)
        .order_by(AssessmentAttempt.submitted_at.desc())
        .all()
    )

    return [
        {
            "attempt_id": attempt.id,
            "student_id": student.id,
            "student_name": student.name,
            "student_email": student.email,
            "score": attempt.score,
            "max_score": attempt.max_score,
            "review_status": attempt.review_status,
            "submitted_at": attempt.submitted_at,
        }
        for attempt, student in rows
    ]
