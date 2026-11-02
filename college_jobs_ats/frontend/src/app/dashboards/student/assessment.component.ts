import { CommonModule } from "@angular/common";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Component, OnInit, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { API_URL } from "../../core/api";

interface AssessmentQuestion {
  id: number;
  category: string;
  question: string;
  marks: number;
}

interface JobResponse {
  id?: number | string;
  title?: string;
  job_title?: string;
  role?: string;
}

interface AssessmentSubmitResponse {
  message?: string;
  status?: string;
  attempt_id?: number;
  score?: number;
  total_marks?: number;
  provisional_score?: number;
  max_score?: number;
  review_status?: string;
}

interface AssessmentResult {
  provisional_score: number;
  max_score: number;
  review_status: string;
}

@Component({
  selector: "app-student-assessment",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: "./assessment.component.html",
  styleUrls: ["./assessment.component.css"],
})
export class StudentAssessmentComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  jobId = "";
  jobIdInput = "";
  jobIdError = "";
  jobTitle = "Job assessment";

  loadingJob = false;
  submitting = false;
  submitted = false;

  errorMessage = "";
  submitError = "";
  successMessage = "";
  pasteMessage = "";

  result: AssessmentResult | null = null;
  answers: Record<number, string> = {};

  readonly questions: AssessmentQuestion[] = [
    {
      id: 1,
      category: "TYPESCRIPT",
      question:
        "Explain interfaces, types and classes in TypeScript and when you use them.",
      marks: 5,
    },
    {
      id: 2,
      category: "JAVASCRIPT",
      question:
        "Explain the difference between var, let and const. Give examples of when to use each.",
      marks: 5,
    },
    {
      id: 3,
      category: "ANGULAR",
      question:
        "What are Angular components and services? Explain how dependency injection works.",
      marks: 5,
    },
    {
      id: 4,
      category: "ANGULAR",
      question:
        "Explain data binding in Angular and describe interpolation, property binding, event binding and two-way binding.",
      marks: 5,
    },
    {
      id: 5,
      category: "HTML & CSS",
      question:
        "How would you build a responsive webpage that works well on mobile, tablet and desktop?",
      marks: 5,
    },
    {
      id: 6,
      category: "PYTHON",
      question:
        "Explain Python lists, tuples, sets and dictionaries with practical examples.",
      marks: 5,
    },
    {
      id: 7,
      category: "PYTHON",
      question:
        "What is the difference between a Python function, a class and an object?",
      marks: 5,
    },
    {
      id: 8,
      category: "BACKEND",
      question:
        "What is a REST API? Explain GET, POST, PUT, PATCH and DELETE with examples.",
      marks: 5,
    },
    {
      id: 9,
      category: "FASTAPI",
      question:
        "How do you create an endpoint in FastAPI, validate request data and return a response?",
      marks: 5,
    },
    {
      id: 10,
      category: "DATABASE",
      question:
        "Explain the difference between SQL and NoSQL databases. When would you choose each?",
      marks: 5,
    },
    {
      id: 11,
      category: "AUTHENTICATION",
      question:
        "Explain how JWT authentication works and how you would protect an API endpoint.",
      marks: 5,
    },
    {
      id: 12,
      category: "DEBUGGING",
      question:
        "Describe the steps you take to investigate and fix an API that returns a 500 error.",
      marks: 5,
    },
    {
      id: 13,
      category: "GIT",
      question:
        "Explain how you use Git branches, commits, pull requests and merge conflict resolution.",
      marks: 5,
    },
    {
      id: 14,
      category: "TESTING",
      question:
        "How would you test a registration form and its backend API, including invalid input cases?",
      marks: 5,
    },
    {
      id: 15,
      category: "PROJECT",
      question:
        "Describe a full-stack project you built, the technologies used, one challenge and how you solved it.",
      marks: 5,
    },
  ];

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = (params.get("jobId") || "").trim();

      this.errorMessage = "";
      this.jobIdError = "";
      this.submitError = "";
      this.successMessage = "";
      this.result = null;
      this.submitted = false;
      this.answers = {};

      if (!id) {
        this.jobId = "";
        this.jobIdInput = "";
        this.jobTitle = "Job assessment";
        this.loadingJob = false;
        return;
      }

      if (!/^\d+$/.test(id) || Number(id) <= 0) {
        this.jobId = "";
        this.jobIdInput = id;
        this.loadingJob = false;
        this.jobIdError = "Please enter a valid numeric job ID.";
        return;
      }

      this.jobId = id;
      this.jobIdInput = id;
      this.loadJob();
    });
  }

  get totalMarks(): number {
    return this.questions.reduce((sum, question) => sum + question.marks, 0);
  }

  get answeredCount(): number {
    return this.questions.filter(
      (question) => (this.answers[question.id] || "").trim().length > 0,
    ).length;
  }

  get progress(): number {
    return this.questions.length
      ? (this.answeredCount / this.questions.length) * 100
      : 0;
  }

  get allAnswered(): boolean {
    return this.answeredCount === this.questions.length;
  }

  openAssessment(): void {
    const id = this.jobIdInput.trim();
    const numericId = Number(id);

    this.jobIdError = "";
    this.errorMessage = "";

    if (!id) {
      this.jobIdError = "Enter a job ID to continue.";
      return;
    }

    if (
      !/^\d+$/.test(id) ||
      !Number.isSafeInteger(numericId) ||
      numericId <= 0
    ) {
      this.jobIdError = "Please enter a valid numeric job ID.";
      return;
    }

    void this.router.navigate(["/student/assessment", numericId]);
  }

  private getAuthHeaders(): HttpHeaders {
    const token =
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      "";

    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }

  private loadJob(): void {
    this.loadingJob = true;
    this.errorMessage = "";

    this.http
      .get<JobResponse>(`${API_URL}/jobs/${encodeURIComponent(this.jobId)}`, {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (job) => {
          this.jobTitle =
            job.title || job.job_title || job.role || "Job assessment";
          this.loadingJob = false;
        },
        error: (err) => {
          console.error("Could not load job details:", err);
          this.jobTitle = "Job assessment";
          this.loadingJob = false;
        },
      });
  }

  updateProgress(): void {
    this.submitError = "";
    this.pasteMessage = "";
  }

  preventPaste(event: ClipboardEvent): void {
    event.preventDefault();
    this.pasteMessage = "Please type your own answer in the text box.";
  }

  preventDrop(event: DragEvent): void {
    event.preventDefault();
    this.pasteMessage = "Please type your own answer in the text box.";
  }

  preventPasteShortcut(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    const pasteShortcut =
      (event.ctrlKey || event.metaKey) && ["v", "x"].includes(key);

    if (pasteShortcut || (event.shiftKey && key === "insert")) {
      event.preventDefault();
      this.pasteMessage = "Please type your own answer in the text box.";
    }
  }

  clearPasteMessage(): void {
    this.pasteMessage = "";
  }

  submitAssessment(): void {
    if (this.submitting || this.submitted) {
      return;
    }

    const numericJobId = Number(this.jobId);

    if (
      !this.jobId ||
      !Number.isSafeInteger(numericJobId) ||
      numericJobId <= 0
    ) {
      this.submitError = "Open a valid job assessment before submitting.";
      return;
    }

    if (!this.getAuthHeaders().has("Authorization")) {
      this.submitError = "Your session has expired. Please log in again.";
      return;
    }

    if (!this.allAnswered) {
      this.submitError = "Please answer all 15 questions before submitting.";
      return;
    }

    this.submitting = true;
    this.submitError = "";
    this.successMessage = "";

    const payload = {
      job_id: numericJobId,
      answers: this.questions.map((question) => ({
        question_id: question.id,
        answer: (this.answers[question.id] || "").trim(),
      })),
    };

    this.http
      .post<AssessmentSubmitResponse>(`${API_URL}/assessment/submit`, payload, {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (response) => {
          this.submitting = false;
          this.submitted = true;

          this.result = {
            provisional_score: Number(
              response.provisional_score ?? response.score ?? 0,
            ),
            max_score: Number(
              response.max_score ?? response.total_marks ?? this.totalMarks,
            ),
            review_status:
              response.review_status || response.status || "pending_review",
          };

          this.successMessage =
            response.message ||
            "Your assessment has been submitted successfully.";
        },
        error: (err) => {
          console.error("Assessment submission failed:", err);

          this.submitting = false;

          if (err.status === 0) {
            this.submitError =
              "Cannot connect to the backend. Check that FastAPI is running.";
          } else if (err.status === 401) {
            this.submitError = "Session expired. Please log in again.";
          } else if (err.status === 403) {
            this.submitError =
              "Only student accounts can submit this assessment.";
          } else if (err.status === 404) {
            this.submitError =
              "Job or assessment endpoint not found. Check the job ID and API URL.";
          } else if (err.status === 409) {
            this.submitError =
              "You have already submitted this assessment for this job.";
          } else if (err.status === 422) {
            this.submitError =
              typeof err.error?.detail === "string"
                ? err.error.detail
                : "The submitted answers are invalid. Check the request format.";
          } else {
            this.submitError =
              err.error?.detail ||
              "Could not submit the assessment. Check the backend logs.";
          }
        },
      });
  }

  goBack(): void {
    void this.router.navigateByUrl("/student/jobs");
  }
}
