import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpClient } from "@angular/common/http";

import { API_URL } from "../../core/api";
import { ResumeService } from "../../core/resume.service";

interface CompanyApplication {
  id: number;
  job_id: number;
  job_title?: string | null;

  student_id: number;
  student_name?: string | null;
  student_email?: string | null;

  status: string;

  resume_filename?: string | null;

  ats_score?: number | null;
  skill_score?: number | null;
  education_score?: number | null;
  experience_score?: number | null;

  ats_recommendation?: string | null;

  matched_skills?: string[] | string | null;
  missing_skills?: string[] | string | null;

  ats_notes?: string | null;

  created_at?: string | null;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./applications.component.html",
  styleUrl: "./applications.component.css",
})
export class CompanyApplicationsComponent implements OnInit {
  private http = inject(HttpClient);
  private resumes = inject(ResumeService);

  applications: CompanyApplication[] = [];
  filteredApplications: CompanyApplication[] = [];

  loading = false;
  error = "";

  search = "";
  statusFilter = "all";
  scoreFilter = "all";
  sort = "newest";

  page = 1;
  pageSize = 10;

  selectedApplication: CompanyApplication | null = null;

  updatingId: number | null = null;

  protected readonly Math = Math;

  ngOnInit(): void {
    this.load();
  }

  // ============================================================
  // LOAD APPLICATIONS
  // ============================================================
  load(): void {
    this.loading = true;
    this.error = "";

    const params = {
      page: "1",
      page_size: "100",
      sort: this.sort,
    };

    this.http.get<any>(`${API_URL}/applications/search`, { params }).subscribe({
      next: (response) => {
        // /applications/search returns { items, total, pages, ... }
        this.applications = Array.isArray(response?.items)
          ? response.items
          : [];

        this.page = 1;
        this.applyFilters();
        this.loading = false;
      },

      error: (err) => {
        console.error("Company applications error:", err);

        this.error =
          err?.error?.detail ||
          "Unable to load applications. Please try again.";

        this.applications = [];
        this.filteredApplications = [];
        this.loading = false;
      },
    });
  }

  // ============================================================
  // SEARCH / FILTER
  // ============================================================

  applyFilters(): void {
    let result = [...this.applications];

    const searchValue = this.search.trim().toLowerCase();

    if (searchValue) {
      result = result.filter((app) => {
        const studentName = this.studentName(app).toLowerCase();
        const studentEmail = (app.student_email || "").toLowerCase();
        const jobTitle = this.jobTitle(app).toLowerCase();
        const resume = (app.resume_filename || "").toLowerCase();

        return (
          studentName.includes(searchValue) ||
          studentEmail.includes(searchValue) ||
          jobTitle.includes(searchValue) ||
          resume.includes(searchValue) ||
          String(app.id).includes(searchValue) ||
          String(app.student_id).includes(searchValue) ||
          String(app.job_id).includes(searchValue)
        );
      });
    }

    if (this.statusFilter !== "all") {
      result = result.filter(
        (app) =>
          (app.status || "").toLowerCase() === this.statusFilter.toLowerCase(),
      );
    }

    if (this.scoreFilter !== "all") {
      result = result.filter((app) => {
        const score = Number(app.ats_score ?? 0);

        switch (this.scoreFilter) {
          case "excellent":
            return score >= 80;

          case "good":
            return score >= 60 && score < 80;

          case "low":
            return score < 60;

          default:
            return true;
        }
      });
    }

    // Sorting
    result.sort((a, b) => {
      switch (this.sort) {
        case "oldest":
          return this.dateValue(a) - this.dateValue(b);

        case "highest":
          return Number(b.ats_score ?? -1) - Number(a.ats_score ?? -1);

        case "lowest":
          return Number(a.ats_score ?? 999) - Number(b.ats_score ?? 999);

        case "candidate":
          return this.studentName(a)
            .toLowerCase()
            .localeCompare(this.studentName(b).toLowerCase());

        case "newest":
        default:
          return this.dateValue(b) - this.dateValue(a);
      }
    });

    this.filteredApplications = result;

    const totalPages = Math.max(1, Math.ceil(result.length / this.pageSize));

    if (this.page > totalPages) {
      this.page = totalPages;
    }
  }

  onSearch(): void {
    this.page = 1;
    this.applyFilters();
  }

  clearFilters(): void {
    this.search = "";
    this.statusFilter = "all";
    this.scoreFilter = "all";
    this.sort = "newest";
    this.page = 1;

    this.applyFilters();
  }

  changeStatusFilter(status: string): void {
    this.statusFilter = status;
    this.page = 1;
    this.applyFilters();
  }

  changeScoreFilter(score: string): void {
    this.scoreFilter = score;
    this.page = 1;
    this.applyFilters();
  }

  changeSort(sort: string): void {
    this.sort = sort;
    this.page = 1;
    this.applyFilters();
  }

  // ============================================================
  // PAGINATION
  // ============================================================

  get totalPages(): number {
    return Math.max(
      1,
      Math.ceil(this.filteredApplications.length / this.pageSize),
    );
  }

  get paginatedApplications(): CompanyApplication[] {
    const start = (this.page - 1) * this.pageSize;

    return this.filteredApplications.slice(start, start + this.pageSize);
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];

    const start = Math.max(1, this.page - 2);
    const end = Math.min(this.totalPages, this.page + 2);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  }

  previousPage(): void {
    if (this.page > 1) {
      this.page--;
    }
  }

  nextPage(): void {
    if (this.page < this.totalPages) {
      this.page++;
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.page) {
      this.page = page;
    }
  }

  // ============================================================
  // STATUS
  // ============================================================

  status(id: number, value: string): void {
    this.updatingId = id;

    const form = new FormData();
    form.append("new_status", value);

    this.http.patch(`${API_URL}/applications/${id}/status`, form).subscribe({
      next: () => {
        const application = this.applications.find((item) => item.id === id);

        if (application) {
          application.status = value;
        }

        this.updatingId = null;

        this.applyFilters();

        if (this.selectedApplication?.id === id) {
          this.selectedApplication = {
            ...this.selectedApplication,
            status: value,
          };
        }
      },

      error: (err) => {
        console.error("Status update error:", err);

        this.updatingId = null;

        alert(err?.error?.detail || "Unable to update application status.");
      },
    });
  }

  // ============================================================
  // DETAILS
  // ============================================================

  openDetails(app: CompanyApplication): void {
    this.selectedApplication = app;
  }

  closeDetails(): void {
    this.selectedApplication = null;
  }

  // ============================================================
  // RESUME
  // ============================================================

  openResume(event: Event, app: CompanyApplication): void {
    event.preventDefault();

    this.resumes.open(app.id, app.resume_filename);
  }

  // ============================================================
  // HELPERS
  // ============================================================

  studentName(app: CompanyApplication): string {
    return app.student_name?.trim() || `Student #${app.student_id}`;
  }

  studentEmail(app: CompanyApplication): string {
    return app.student_email || "Email not available";
  }

  jobTitle(app: CompanyApplication): string {
    return app.job_title?.trim() || `Job #${app.job_id}`;
  }

  initials(app: CompanyApplication): string {
    const name = this.studentName(app);

    const parts = name.trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
      return "?";
    }

    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }

    return (
      parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
    ).toUpperCase();
  }

  score(app: CompanyApplication): number | null {
    if (app.ats_score === null || app.ats_score === undefined) {
      return null;
    }

    return Number(app.ats_score);
  }

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

  statusClass(status: string | null | undefined): string {
    return `status-${(status || "applied").toLowerCase()}`;
  }

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

  skills(value: string[] | string | null | undefined): string[] {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value.filter(Boolean);
    }

    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean);
      }

      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  skillText(value: string[] | string | null | undefined): string {
    const list = this.skills(value);

    return list.length ? list.join(", ") : "-";
  }

  dateValue(app: CompanyApplication): number {
    if (!app.created_at) {
      return 0;
    }

    const value = new Date(app.created_at).getTime();

    return Number.isNaN(value) ? 0 : value;
  }

  formattedDate(value: string | null | undefined): string {
    if (!value) {
      return "Recently";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Recently";
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  // ============================================================
  // KPI COUNTS
  // ============================================================

  get totalCount(): number {
    return this.applications.length;
  }

  get appliedCount(): number {
    return this.countStatus("applied");
  }

  get reviewingCount(): number {
    return this.countStatus("reviewing");
  }

  get shortlistedCount(): number {
    return this.countStatus("shortlisted");
  }

  get selectedCount(): number {
    return this.countStatus("selected");
  }

  get rejectedCount(): number {
    return this.countStatus("rejected");
  }

  private countStatus(status: string): number {
    return this.applications.filter(
      (app) => (app.status || "").toLowerCase() === status,
    ).length;
  }

  get averageScore(): number {
    const scored = this.applications.filter(
      (app) => app.ats_score !== null && app.ats_score !== undefined,
    );

    if (!scored.length) {
      return 0;
    }

    const total = scored.reduce(
      (sum, app) => sum + Number(app.ats_score || 0),
      0,
    );

    return Math.round((total / scored.length) * 10) / 10;
  }

  get selectedCountForView(): number {
    return this.selectedCount;
  }

  refresh(): void {
    this.load();
  }
}
