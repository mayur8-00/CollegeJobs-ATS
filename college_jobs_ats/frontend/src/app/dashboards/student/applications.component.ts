import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpClient } from "@angular/common/http";

import { API_URL } from "../../core/api";
import { ResumeService } from "../../core/resume.service";

export interface Application {
  id: number;
  job_id: number;
  student_id?: number;
  job_title?: string | null;
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
  created_at: string;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./applications.component.html",
  styleUrl: "./applications.component.css",
})
export class StudentApplicationsComponent implements OnInit {
  private http = inject(HttpClient);
  private resumes = inject(ResumeService);

  applications: Application[] = [];
  loading = false;
  error = "";
  selectedApplication: Application | null = null;

  selectedStatus = "all";
  searchText = "";

  ngOnInit(): void {
    this.loadApplications();
  }

  // Load the logged-in student's applications
  loadApplications(): void {
    this.loading = true;
    this.error = "";

    this.http.get<Application[]>(`${API_URL}/applications/mine`).subscribe({
      next: (data) => {
        this.applications = Array.isArray(data) ? data : [];
        this.loading = false;
      },
      error: (err) => {
        console.error("Student applications API error:", err);

        this.applications = [];
        this.loading = false;

        if (err?.status === 401) {
          this.error = "Your session has expired. Please login again.";
        } else if (err?.status === 403) {
          this.error = "You do not have permission to view your applications.";
        } else if (err?.status === 404) {
          this.error = "Applications endpoint was not found.";
        } else {
          this.error =
            err?.error?.detail ||
            "Unable to load your applications. Please try again.";
        }
      },
    });
  }

  refresh(): void {
    this.loadApplications();
  }

  applyFilters(): void {
    // Filtering is handled by filteredApplications.
  }

  setStatus(status: string): void {
    this.selectedStatus = status.toLowerCase();
  }

  clearFilters(): void {
    this.searchText = "";
    this.selectedStatus = "all";
  }

  // Filter applications by status and search text
  get filteredApplications(): Application[] {
    const search = this.searchText.trim().toLowerCase();

    return this.applications.filter((app) => {
      const statusMatch =
        this.selectedStatus === "all" ||
        app.status?.toLowerCase() === this.selectedStatus;

      if (!statusMatch) {
        return false;
      }

      if (!search) {
        return true;
      }

      return [
        this.getJobTitle(app),
        this.getResumeName(app),
        app.status || "",
        this.getRecommendation(app),
        String(app.id),
        String(app.job_id),
      ].some((value) => value.toLowerCase().includes(search));
    });
  }

  get hasApplications(): boolean {
    return this.applications.length > 0;
  }

  get hasFilteredResults(): boolean {
    return this.filteredApplications.length > 0;
  }

  get totalApplications(): number {
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
      (app) => app.status?.toLowerCase() === status,
    ).length;
  }

  get averageScore(): number {
    const scores = this.applications
      .map((app) => this.getScore(app))
      .filter((score) => score > 0);

    if (scores.length === 0) {
      return 0;
    }

    return (
      Math.round(
        (scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10,
      ) / 10
    );
  }

  trackByApplication(index: number, application: Application): number {
    return application.id;
  }

  openDetails(application: Application): void {
    this.selectedApplication = application;
  }

  closeDetails(): void {
    this.selectedApplication = null;
  }

  // Application status
  getStatusLabel(application: Application): string {
    switch (application.status?.toLowerCase()) {
      case "applied":
        return "Applied";
      case "reviewing":
        return "Under Review";
      case "shortlisted":
        return "Shortlisted";
      case "selected":
        return "Selected";
      case "rejected":
        return "Rejected";
      default:
        return "Applied";
    }
  }

  getStatusClass(application: Application): string {
    return this.statusClass(application.status);
  }

  // Kept for templates that pass a status string
  statusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case "applied":
        return "status-applied";
      case "reviewing":
        return "status-reviewing";
      case "shortlisted":
        return "status-shortlisted";
      case "selected":
        return "status-selected";
      case "rejected":
        return "status-rejected";
      default:
        return "status-applied";
    }
  }

  // Actual job position name from the API
  getJobTitle(application: Application): string {
    return application.job_title?.trim() || `Job #${application.job_id}`;
  }

  // ATS score
  getScore(application: Application): number {
    const score = Number(application.ats_score);

    if (!Number.isFinite(score)) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
  }

  getScoreClass(score: number): string {
    if (score >= 80) {
      return "score-high";
    }
    if (score >= 60) {
      return "score-medium";
    }
    if (score > 0) {
      return "score-low";
    }
    return "score-none";
  }

  scoreClass(score: number | null | undefined): string {
    return this.getScoreClass(Number(score) || 0);
  }

  getScoreLabel(application: Application): string {
    const score = this.getScore(application);

    if (score >= 80) {
      return "Excellent Match";
    }
    if (score >= 60) {
      return "Good Match";
    }
    if (score > 0) {
      return "Low Match";
    }
    return "Not Available";
  }

  // ATS breakdown
  getSkillScore(application: Application): number {
    return this.normalizeScore(application.skill_score);
  }

  getEducationScore(application: Application): number {
    return this.normalizeScore(application.education_score);
  }

  getExperienceScore(application: Application): number {
    return this.normalizeScore(application.experience_score);
  }

  private normalizeScore(value: number | null | undefined): number {
    const score = Number(value);

    if (!Number.isFinite(score)) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
  }

  // ATS recommendation
  getRecommendation(application: Application): string {
    return application.ats_recommendation?.trim() || "Not Available";
  }

  getRecommendationClass(application: Application): string {
    return this.recommendationClass(this.getRecommendation(application));
  }

  recommendationClass(recommendation: string | null | undefined): string {
    if (!recommendation) {
      return "recommendation-neutral";
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

  // Skills
  getMatchedSkills(application: Application): string[] {
    return this.parseSkills(application.matched_skills);
  }

  getMissingSkills(application: Application): string[] {
    return this.parseSkills(application.missing_skills);
  }

  private parseSkills(value: string[] | string | null | undefined): string[] {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value.map((skill) => String(skill).trim()).filter(Boolean);
    }

    try {
      const parsed: unknown = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed.map((skill) => String(skill).trim()).filter(Boolean);
      }

      if (parsed !== null && parsed !== undefined) {
        return [String(parsed).trim()].filter(Boolean);
      }
    } catch {
      return value
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean);
    }

    return [];
  }

  // Resume
  getResumeName(application: Application): string {
    return application.resume_filename || "Resume not available";
  }

  openResume(event: Event, application: Application): void {
    event.preventDefault();

    if (!application.resume_filename) {
      return;
    }

    this.resumes.open(application.id, application.resume_filename);
  }

  // Dates
  getApplicationDate(application: Application): string {
    if (!application.created_at) {
      return "Date not available";
    }

    const date = new Date(application.created_at);

    if (Number.isNaN(date.getTime())) {
      return "Date not available";
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  getRelativeDate(application: Application): string {
    if (!application.created_at) {
      return "Date not available";
    }

    const date = new Date(application.created_at);

    if (Number.isNaN(date.getTime())) {
      return "Date not available";
    }

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) {
      return "Just now";
    }
    if (diffMinutes < 60) {
      return `${diffMinutes} min ago`;
    }
    if (diffHours < 24) {
      return `${diffHours} hr ago`;
    }
    if (diffDays === 1) {
      return "Yesterday";
    }
    if (diffDays < 7) {
      return `${diffDays} days ago`;
    }

    return this.getApplicationDate(application);
  }
}
