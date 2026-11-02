import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from "@angular/core";

import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { HttpClient } from "@angular/common/http";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { finalize } from "rxjs";

import { API_URL } from "../../core/api";

interface DashboardStats {
  totalUsers?: number;
  total_users?: number;
  users?: number;

  totalStudents?: number;
  total_students?: number;
  students?: number;

  totalJobs?: number;
  total_jobs?: number;
  jobs?: number;

  totalApplications?: number;
  total_applications?: number;
  applications?: number;
}

@Component({
  selector: "app-admin-dashboard",
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: "./dashboard.component.html",
  styleUrl: "./dashboard.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  stats: DashboardStats = {};
  loading = true;
  refreshing = false;
  errorMessage = "";

  ngOnInit(): void {
    this.loadDashboardStats();
  }

  get totalUsers(): number {
    return this.readCount(
      this.stats.totalUsers,
      this.stats.total_users,
      this.stats.users,
    );
  }

  get totalStudents(): number {
    return this.readCount(
      this.stats.totalStudents,
      this.stats.total_students,
      this.stats.students,
    );
  }

  get totalJobs(): number {
    return this.readCount(
      this.stats.totalJobs,
      this.stats.total_jobs,
      this.stats.jobs,
    );
  }

  get totalApplications(): number {
    return this.readCount(
      this.stats.totalApplications,
      this.stats.total_applications,
      this.stats.applications,
    );
  }

  refreshDashboard(): void {
    this.loadDashboardStats(true);
  }

  private loadDashboardStats(isRefresh = false): void {
    if (isRefresh) {
      this.refreshing = true;
    } else {
      this.loading = true;
    }

    this.errorMessage = "";

    this.http
      .get<DashboardStats>(`${API_URL}/dashboard/stats`)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.loading = false;
          this.refreshing = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (response) => {
          this.stats = response ?? {};
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error("Failed to load admin dashboard statistics:", error);

          this.errorMessage =
            "Unable to refresh dashboard statistics. Please try again.";

          this.cdr.markForCheck();
        },
      });
  }

  private readCount(...values: unknown[]): number {
    for (const value of values) {
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        return value;
      }

      if (
        typeof value === "string" &&
        value.trim() !== "" &&
        Number.isFinite(Number(value)) &&
        Number(value) >= 0
      ) {
        return Number(value);
      }
    }

    return 0;
  }
}
