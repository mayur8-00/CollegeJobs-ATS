import { CommonModule } from "@angular/common";
import { Component, inject, OnInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { API_URL } from "../../core/api";

@Component({
  selector: "app-admin-job-details",
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: "./job-details.component.html",
  styleUrl: "./job-details.component.css",
})
export class AdminJobDetailsComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  job: any = null;
  loading = true;
  error = "";

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get("jobId"));

    if (!Number.isInteger(id) || id <= 0) {
      this.error = "Invalid job ID.";
      this.loading = false;
      return;
    }

    // Reuse the existing jobs API and find this job by ID.
    this.http.get<any>(`${API_URL}/jobs/`).subscribe({
      next: (response) => {
        const jobs = Array.isArray(response)
          ? response
          : (response?.items ?? response?.jobs ?? []);

        this.job = jobs.find((item: any) => Number(item.id) === id) ?? null;

        if (!this.job) {
          this.error = "Job not found or no longer available.";
        }

        this.loading = false;
      },
      error: () => {
        this.error = "Unable to load job details. Please try again.";
        this.loading = false;
      },
    });
  }

  get skills(): string[] {
    const value = this.job?.skills;

    if (Array.isArray(value)) {
      return value;
    }

    return typeof value === "string"
      ? value
          .split(",")
          .map((skill: string) => skill.trim())
          .filter(Boolean)
      : [];
  }
}
