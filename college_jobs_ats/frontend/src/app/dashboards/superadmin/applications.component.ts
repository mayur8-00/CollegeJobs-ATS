import { Component, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpClient } from "@angular/common/http";

import { API_URL } from "../../core/api";
import { ResumeService } from "../../core/resume.service";

interface Application {
  id: number;

  job_id: number;
  job_title: string;

  student_id: number;
  student_name: string;
  student_email: string;

  status: string;

  resume_filename?: string | null;

  ats_score?: number | null;
  skill_score?: number | null;
  education_score?: number | null;
  experience_score?: number | null;

  ats_recommendation?: string | null;

  matched_skills?: string[];
  missing_skills?: string[];

  ats_notes?: string | null;

  created_at?: string;
}

interface StatusCounts {
  all?: number;
  applied?: number;
  reviewing?: number;
  shortlisted?: number;
  selected?: number;
  rejected?: number;
}

interface ApplicationResponse {
  items: Application[];

  total: number;

  page: number;

  page_size: number;

  pages: number;

  status_counts: StatusCounts;
}

@Component({
  standalone: true,

  imports: [CommonModule, FormsModule],

  templateUrl: "./applications.component.html",

  styleUrl: "./applications.component.css",
})
export class SuperadminApplicationsComponent implements OnInit {
  /*
   * Angular templates cannot directly access the global Math object.
   * Exposing it here allows:
   *
   * {{ Math.min(...) }}
   *
   * inside applications.component.html.
   */
  protected readonly Math = Math;

  private http = inject(HttpClient);

  private resumes = inject(ResumeService);

  // ============================================================
  // DATA
  // ============================================================

  applications: Application[] = [];

  // ============================================================
  // UI STATE
  // ============================================================

  loading = false;

  updatingId: number | null = null;

  error = "";

  // ============================================================
  // SEARCH / FILTER
  // ============================================================

  search = "";

  statusFilter = "all";

  sort = "newest";

  minScore: number | null = null;

  // ============================================================
  // PAGINATION
  // ============================================================

  page = 1;

  pageSize = 20;

  pages = 1;

  total = 0;

  // ============================================================
  // STATUS COUNTS
  // ============================================================

  statusCounts: StatusCounts = {};

  // ============================================================
  // DETAILS DRAWER
  // ============================================================

  selectedApplication: Application | null = null;

  // ============================================================
  // COMPONENT INIT
  // ============================================================

  ngOnInit(): void {
    this.load();
  }

  // ============================================================
  // LOAD APPLICATIONS
  // ============================================================

  load(): void {
    this.loading = true;

    this.error = "";

    const params: Record<string, string | number> = {
      page: this.page,
      page_size: this.pageSize,
      sort: this.sort,
    };

    // Search
    if (this.search.trim()) {
      params["q"] = this.search.trim();
    }

    // Status filter
    if (this.statusFilter !== "all") {
      params["status"] = this.statusFilter;
    }

    // Minimum ATS score
    if (this.minScore !== null) {
      params["min_score"] = this.minScore;
    }

    this.http
      .get<ApplicationResponse>(`${API_URL}/applications/search`, {
        params,
      })
      .subscribe({
        next: (response) => {
          this.applications = response.items || [];

          this.total = response.total || 0;

          this.page = response.page || 1;

          this.pages = response.pages || 1;

          this.statusCounts = response.status_counts || {};

          this.loading = false;
        },

        error: (error) => {
          console.error("Applications API error:", error);

          this.error =
            error?.error?.detail ||
            "Unable to load applications. Please try again.";

          this.loading = false;
        },
      });
  }

  // ============================================================
  // SEARCH
  // ============================================================

  searchApplications(): void {
    this.page = 1;

    this.load();
  }

  // ============================================================
  // CLEAR SEARCH / FILTERS
  // ============================================================

  clearSearch(): void {
    this.search = "";

    this.statusFilter = "all";

    this.minScore = null;

    this.sort = "newest";

    this.page = 1;

    this.load();
  }

  // ============================================================
  // STATUS FILTER
  // ============================================================

  setStatus(status: string): void {
    this.statusFilter = status;

    this.page = 1;

    this.load();
  }

  // ============================================================
  // SORT
  // ============================================================

  setSort(value: string): void {
    this.sort = value;

    this.page = 1;

    this.load();
  }

  // ============================================================
  // ATS SCORE FILTER
  // ============================================================

  setScore(value: string): void {
    this.minScore = value === "" ? null : Number(value);

    this.page = 1;

    this.load();
  }

  // ============================================================
  // PAGINATION - PREVIOUS
  // ============================================================

  previousPage(): void {
    if (this.page > 1) {
      this.page--;

      this.load();
    }
  }

  // ============================================================
  // PAGINATION - NEXT
  // ============================================================

  nextPage(): void {
    if (this.page < this.pages) {
      this.page++;

      this.load();
    }
  }

  // ============================================================
  // PAGINATION - SPECIFIC PAGE
  // ============================================================

  goToPage(page: number): void {
    if (page < 1 || page > this.pages || page === this.page) {
      return;
    }

    this.page = page;

    this.load();
  }

  // ============================================================
  // PAGINATION PAGE NUMBERS
  // ============================================================

  get pageNumbers(): number[] {
    const result: number[] = [];

    const start = Math.max(1, this.page - 2);

    const end = Math.min(this.pages, this.page + 2);

    for (let i = start; i <= end; i++) {
      result.push(i);
    }

    return result;
  }

  // ============================================================
  // UPDATE APPLICATION STATUS
  // ============================================================

  status(id: number, value: string): void {
    this.updatingId = id;

    const form = new FormData();

    form.append("new_status", value);

    this.http.patch(`${API_URL}/applications/${id}/status`, form).subscribe({
      next: () => {
        this.updatingId = null;

        this.load();

        if (this.selectedApplication?.id === id) {
          this.selectedApplication = null;
        }
      },

      error: (error) => {
        console.error("Status update error:", error);

        this.updatingId = null;

        alert(error?.error?.detail || "Unable to update application status.");
      },
    });
  }

  // ============================================================
  // OPEN APPLICATION DETAILS
  // ============================================================

  openDetails(app: Application): void {
    this.selectedApplication = app;
  }

  // ============================================================
  // CLOSE APPLICATION DETAILS
  // ============================================================

  closeDetails(): void {
    this.selectedApplication = null;
  }

  // ============================================================
  // OPEN RESUME
  // ============================================================

  openResume(
    event: Event,

    app: {
      id: number;
      resume_filename?: string | null;
    },
  ): void {
    event.preventDefault();

    this.resumes.open(app.id, app.resume_filename);
  }

  // ============================================================
  // SKILLS FORMATTER
  // ============================================================

  skills(value: string[] | null | undefined): string {
    if (!value || value.length === 0) {
      return "-";
    }

    return value.join(", ");
  }

  // ============================================================
  // SCORE CSS CLASS
  // ============================================================

  scoreClass(score: number | null | undefined): string {
    if (score === null || score === undefined) {
      return "score-none";
    }

    if (score >= 80) {
      return "score-high";
    }

    if (score >= 60) {
      return "score-medium";
    }

    return "score-low";
  }

  // ============================================================
  // STATUS CSS CLASS
  // ============================================================

  statusClass(status: string): string {
    return `status-${status.toLowerCase()}`;
  }

  // ============================================================
  // RECOMMENDATION CSS CLASS
  // ============================================================

  recommendationClass(recommendation: string | null | undefined): string {
    if (!recommendation) {
      return "recommendation-none";
    }

    const value = recommendation.toLowerCase();

    if (value.includes("select")) {
      return "recommendation-selected";
    }

    if (value.includes("short")) {
      return "recommendation-shortlisted";
    }

    if (value.includes("reject")) {
      return "recommendation-rejected";
    }

    return "recommendation-neutral";
  }

  // ============================================================
  // REFRESH
  // ============================================================

  refresh(): void {
    this.load();
  }
}
