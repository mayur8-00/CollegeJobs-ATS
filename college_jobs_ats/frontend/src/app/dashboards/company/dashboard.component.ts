import { CommonModule } from "@angular/common";
import { Component, OnInit, inject } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { RouterLink } from "@angular/router";
import { API_URL } from "../../core/api";

interface CompanyStats {
  activeJobs: number;
  applications: number;
  reviewing: number;
  shortlisted: number;
  selected: number;
}

interface JobRecord {
  id?: number;
  status?: string;
  is_active?: boolean;
}

interface ApplicationRecord {
  id?: number;
  status?: string;
}

@Component({
  selector: "app-company-dashboard",
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: "./dashboard.component.html",
  styleUrls: ["./dashboard.component.css"],
})
export class CompanyDashboardComponent implements OnInit {
  private readonly http = inject(HttpClient);

  stats: CompanyStats = {
    activeJobs: 0,
    applications: 0,
    reviewing: 0,
    shortlisted: 0,
    selected: 0,
  };

  loading = true;
  error = "";

  ngOnInit(): void {
    this.loadDashboard();
  }

  private getHeaders(): HttpHeaders {
    let token = localStorage.getItem("access_token") || "";

    if (!token) {
      token = localStorage.getItem("token") || "";
    }

    const raw = localStorage.getItem("collegeJobAuth");

    if (!token && raw) {
      try {
        const auth = JSON.parse(raw);
        token = auth?.access_token || auth?.token || "";
      } catch {
        token = raw;
      }
    }

    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }

  private extractArray<T>(response: unknown): T[] {
    if (Array.isArray(response)) {
      return response as T[];
    }

    if (response && typeof response === "object") {
      const data = response as {
        items?: T[];
        jobs?: T[];
        applications?: T[];
      };

      if (Array.isArray(data.items)) return data.items;
      if (Array.isArray(data.jobs)) return data.jobs;
      if (Array.isArray(data.applications)) {
        return data.applications;
      }
    }

    return [];
  }

  private normalizeStatus(status: unknown): string {
    return String(status ?? "")
      .trim()
      .toLowerCase();
  }

  loadDashboard(): void {
    this.loading = true;
    this.error = "";

    const headers = this.getHeaders();

    this.http.get<unknown>(`${API_URL}/jobs/`, { headers }).subscribe({
      next: (response) => {
        const jobs = this.extractArray<JobRecord>(response);

        this.stats.activeJobs = jobs.filter((job) => {
          const status = this.normalizeStatus(job.status);

          return (
            job.is_active !== false &&
            (status === "" || ["active", "published", "open"].includes(status))
          );
        }).length;
      },
      error: (err) => {
        console.error("Could not load company jobs:", err);
        this.error = this.getErrorMessage(err);
      },
    });

    this.http
      .get<unknown>(`${API_URL}/applications/company`, { headers })
      .subscribe({
        next: (response) => {
          const applications = this.extractArray<ApplicationRecord>(response);

          this.stats.applications = applications.length;

          this.stats.reviewing = applications.filter((item) =>
            ["reviewing", "under_review", "screening"].includes(
              this.normalizeStatus(item.status),
            ),
          ).length;

          this.stats.shortlisted = applications.filter((item) =>
            ["shortlisted"].includes(this.normalizeStatus(item.status)),
          ).length;

          this.stats.selected = applications.filter((item) =>
            ["selected"].includes(this.normalizeStatus(item.status)),
          ).length;
        },
        error: (err) => {
          console.error("Could not load company applications:", err);
          this.error = this.getErrorMessage(err);
        },
      });

    // Stop the loading indicator after the requests have had time to finish.
    // The final request callbacks also update the dashboard independently.
    // A failed request is reported in the browser console and error field.
    this.loading = false;
  }

  private getErrorMessage(err: any): string {
    if (err?.status === 401) {
      return "Your session has expired. Please sign in again.";
    }

    if (err?.status === 403) {
      return "You do not have permission to view this information.";
    }

    return (
      err?.error?.detail ||
      err?.error?.message ||
      "Some dashboard information could not be loaded."
    );
  }
}
