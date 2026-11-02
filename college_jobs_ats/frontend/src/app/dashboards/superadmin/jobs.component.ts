import { Component, HostListener, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import { API_URL } from "../../core/api";

interface Job {
  id?: number;
  title?: string;
  description?: string;
  skills?: string;
  location?: string;
  company_name?: string;
  company?: string;
  created_at?: string;
  status?: string;
  job_type?: string;
  employment_type?: string;
}

@Component({
  standalone: true,
  selector: "app-superadmin-jobs",
  imports: [CommonModule, FormsModule],
  templateUrl: "./jobs.component.html",
  styleUrl: "./jobs.component.css",
})
export class SuperadminJobsComponent implements OnInit {
  private http = inject(HttpClient);

  jobs: Job[] = [];
  filteredJobs: Job[] = [];

  loading = true;
  error = "";

  searchTerm = "";
  selectedLocation = "all";
  selectedStatus = "all";
  sortBy = "newest";

  selectedJob: Job | null = null;
  showDetails = false;

  ngOnInit(): void {
    this.loadJobs();
  }

  // Load jobs from FastAPI
  loadJobs(): void {
    this.loading = true;
    this.error = "";

    this.http.get<any>(`${API_URL}/jobs/`).subscribe({
      next: (response) => {
        // Supports array and common paginated response formats.
        const data = Array.isArray(response)
          ? response
          : response?.items || response?.jobs || response?.data || [];

        this.jobs = Array.isArray(data) ? data : [];
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        console.error("Jobs API error:", err);

        this.error =
          typeof err?.error?.detail === "string"
            ? err.error.detail
            : "Unable to load jobs. Please try again.";

        this.jobs = [];
        this.filteredJobs = [];
        this.loading = false;
      },
    });
  }

  // Search, filter and sorting
  applyFilters(): void {
    let result = [...this.jobs];

    const search = this.searchTerm.trim().toLowerCase();

    if (search) {
      result = result.filter((job) => {
        const searchableText = [
          job.title,
          job.description,
          job.skills,
          job.location,
          job.company_name,
          job.company,
          job.job_type,
          job.employment_type,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(search);
      });
    }

    if (this.selectedLocation !== "all") {
      result = result.filter(
        (job) =>
          (job.location || "").trim().toLowerCase() ===
          this.selectedLocation.toLowerCase(),
      );
    }

    if (this.selectedStatus !== "all") {
      result = result.filter(
        (job) =>
          this.getNormalizedStatus(job) === this.selectedStatus.toLowerCase(),
      );
    }

    switch (this.sortBy) {
      case "newest":
        result.sort((a, b) => this.getJobId(b) - this.getJobId(a));
        break;

      case "oldest":
        result.sort((a, b) => this.getJobId(a) - this.getJobId(b));
        break;

      case "az":
        result.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        break;

      case "za":
        result.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
        break;
    }

    this.filteredJobs = result;
  }

  onSearch(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchTerm = "";
    this.selectedLocation = "all";
    this.selectedStatus = "all";
    this.sortBy = "newest";
    this.applyFilters();
  }

  // Available locations
  get locations(): string[] {
    const locations = this.jobs
      .map((job) => (job.location || "").trim())
      .filter(Boolean);

    return [...new Set(locations)].sort();
  }

  // Dashboard statistics
  get totalJobs(): number {
    return this.jobs.length;
  }

  get activeJobs(): number {
    return this.jobs.filter((job) => {
      const status = this.getNormalizedStatus(job);
      return status === "active" || status === "open";
    }).length;
  }

  get locationsCount(): number {
    return new Set(
      this.jobs
        .map((job) => (job.location || "").trim().toLowerCase())
        .filter(Boolean),
    ).size;
  }

  get uniqueSkillsCount(): number {
    const skills = new Set<string>();

    this.jobs.forEach((job) => {
      this.parseSkills(job.skills).forEach((skill) => {
        skills.add(skill.toLowerCase());
      });
    });

    return skills.size;
  }

  // Job helpers
  getJobId(job: Job): number {
    return Number(job.id || 0);
  }

  getCompanyName(job: Job): string {
    return job.company_name || job.company || "CollegeJobs";
  }

  getJobStatus(job: Job): string {
    const status = (job.status || "Active").trim();
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }

  getNormalizedStatus(job: Job): string {
    return (job.status || "active").trim().toLowerCase();
  }

  getJobType(job: Job): string {
    return job.job_type || job.employment_type || "Full-time";
  }

  getCompanyInitial(job: Job): string {
    return this.getCompanyName(job).charAt(0).toUpperCase();
  }

  getStatusClass(job: Job): string {
    const status = this.getNormalizedStatus(job);

    if (status === "active" || status === "open") {
      return "status-active";
    }

    if (status === "closed" || status === "inactive") {
      return "status-closed";
    }

    if (status === "draft") {
      return "status-draft";
    }

    return "status-other";
  }

  // Skills
  parseSkills(skills: string | undefined | null): string[] {
    if (!skills) {
      return [];
    }

    return skills
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean);
  }

  // Description
  shortDescription(description: string | undefined | null): string {
    if (!description) {
      return "No job description available.";
    }

    const clean = description.trim();

    return clean.length <= 145
      ? clean
      : clean.substring(0, 145).trimEnd() + "...";
  }

  // Date
  formatDate(date: string | undefined | null): string {
    if (!date) {
      return "Recently posted";
    }

    const parsed = new Date(date);

    if (isNaN(parsed.getTime())) {
      return "Recently posted";
    }

    return parsed.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  // Job details modal
  openDetails(job: Job): void {
    this.selectedJob = job;
    this.showDetails = true;
    document.body.classList.add("job-details-modal-open");
  }

  closeDetails(): void {
    this.showDetails = false;
    this.selectedJob = null;
    document.body.classList.remove("job-details-modal-open");
  }

  @HostListener("document:keydown.escape")
  onEscapeKey(): void {
    if (this.showDetails) {
      this.closeDetails();
    }
  }

  refresh(): void {
    this.loadJobs();
  }

  trackByJob(index: number, job: Job): number {
    return job.id ?? index;
  }
}
