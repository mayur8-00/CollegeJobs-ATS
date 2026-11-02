import { CommonModule } from "@angular/common";
import { Component, OnInit, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { RouterLink } from "@angular/router";
import { API_URL } from "../../core/api";

interface DashboardStats {
  users?: number;
  students?: number;
  companies?: number;
  jobs?: number;
  applications?: number;
  coding_assessments?: number;
}

@Component({
  selector: "app-superadmin-dashboard",
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: "./dashboard.component.html",
  styleUrl: "./dashboard.component.css",
})
export class SuperadminDashboardComponent implements OnInit {
  private readonly http = inject(HttpClient);

  stats: DashboardStats = {};
  loading = true;
  loadError = false;
  lastUpdated: Date | null = null;

  ngOnInit(): void {
    this.loadDashboard();
  }

  // Load dashboard statistics
  loadDashboard(): void {
    this.loading = true;
    this.loadError = false;

    this.http.get<DashboardStats>(`${API_URL}/dashboard/stats`).subscribe({
      next: (data) => {
        this.stats = data ?? {};
        this.lastUpdated = new Date();
        this.loading = false;
      },
      error: (error) => {
        console.error("Unable to load dashboard statistics:", error);
        this.loadError = true;
        this.loading = false;
      },
    });
  }

  // Refresh dashboard when button is clicked
  refresh(): void {
    if (this.loading) {
      return;
    }

    this.loadDashboard();
  }

  // Get dashboard statistic value
  getValue(key: string): number {
    const value = this.stats[key as keyof DashboardStats];
    return typeof value === "number" ? value : 0;
  }

  // Format last updated time
  get formattedUpdateTime(): string {
    if (!this.lastUpdated) {
      return "Not updated yet";
    }

    return this.lastUpdated.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}
