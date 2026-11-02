import { CommonModule } from "@angular/common";
import { Component, inject, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import { API_URL } from "../../core/api";

interface Job {
  id: number;
  title: string;
}

interface AssessmentResult {
  id?: number;
  student_id?: number;
  student_name?: string;
  student_email?: string;
  job_id?: number;
  job_title?: string;
  answers_json?: Record<string, unknown> | string | unknown[];
  answers?: Record<string, unknown> | string | unknown[];
  score?: number | null;
  max_score?: number;
  review_status?: string;
  feedback?: string | null;
  submitted_at?: string;
  created_at?: string;
}

@Component({
  selector: "app-assessment-results",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./assessment-results.component.html",
  styleUrl: "./assessment-results.component.css",
})
export class AssessmentResultsComponent implements OnInit {
  private http = inject(HttpClient);

  jobs: Job[] = [];
  results: AssessmentResult[] = [];

  selectedJobId = "";
  loadingJobs = false;
  loadingResults = false;
  error = "";

  ngOnInit(): void {
    this.loadJobs();
  }

  loadJobs(): void {
    this.loadingJobs = true;
    this.error = "";

    this.http.get<any>(`${API_URL}/jobs/`).subscribe({
      next: (response) => {
        const data = Array.isArray(response)
          ? response
          : (response?.items ?? response?.jobs ?? []);

        this.jobs = data.map((job: any) => ({
          id: Number(job.id),
          title: job.title || `Job #${job.id}`,
        }));

        this.loadingJobs = false;

        if (this.jobs.length) {
          this.selectedJobId = String(this.jobs[0].id);
          this.loadResults();
        }
      },
      error: (err) => {
        this.loadingJobs = false;
        this.error = err?.error?.detail || "Unable to load jobs.";
      },
    });
  }

  loadResults(): void {
    if (!this.selectedJobId) return;

    this.loadingResults = true;
    this.error = "";
    this.results = [];

    this.http
      .get<any>(
        `${API_URL}/assessment/job/${encodeURIComponent(this.selectedJobId)}/results`,
      )
      .subscribe({
        next: (response) => {
          const data = Array.isArray(response)
            ? response
            : (response?.items ?? response?.results ?? []);

          this.results = data;
          this.loadingResults = false;
        },
        error: (err) => {
          this.loadingResults = false;
          this.error =
            err?.error?.detail ||
            "Unable to load assessment results for this job.";
        },
      });
  }

  get pendingCount(): number {
    return this.results.filter(
      (r) =>
        !r.review_status ||
        ["pending", "pending_review"].includes(r.review_status.toLowerCase()),
    ).length;
  }

  get evaluatedCount(): number {
    return this.results.filter(
      (r) =>
        r.score !== null &&
        r.score !== undefined &&
        !["pending", "pending_review"].includes(
          (r.review_status || "").toLowerCase(),
        ),
    ).length;
  }

  getStudentName(result: AssessmentResult): string {
    return result.student_name || `Student #${result.student_id ?? "—"}`;
  }

  getStatus(result: AssessmentResult): string {
    return (result.review_status || "pending_review")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  getScore(result: AssessmentResult): string {
    if (result.score === null || result.score === undefined) {
      return "Not evaluated";
    }

    return `${result.score} / ${result.max_score ?? 75}`;
  }

  getAnswers(result: AssessmentResult): { question: string; answer: string }[] {
    let source: any = result.answers_json ?? result.answers;

    if (typeof source === "string") {
      try {
        source = JSON.parse(source);
      } catch {
        return [{ question: "Submitted answers", answer: source }];
      }
    }

    if (Array.isArray(source)) {
      return source.map((item: any, index: number) => ({
        question:
          item?.question || item?.question_text || `Question ${index + 1}`,
        answer: String(item?.answer ?? item?.response ?? ""),
      }));
    }

    if (source && typeof source === "object") {
      return Object.entries(source).map(([key, value]) => ({
        question: key,
        answer:
          typeof value === "string" ? value : JSON.stringify(value, null, 2),
      }));
    }

    return [];
  }

  formatDate(value?: string): string {
    if (!value) return "—";

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-IN");
  }

  trackByResult(index: number, result: AssessmentResult): number {
    return result.id ?? index;
  }
}
