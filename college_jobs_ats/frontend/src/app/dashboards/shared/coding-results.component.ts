import { CommonModule } from "@angular/common";
import {
  HttpClient,
  HttpClientModule,
  HttpHeaders,
} from "@angular/common/http";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";

interface CodingResult {
  rank: number;
  job_id: number;
  job_title: string;
  student_id: number;
  student_name: string;
  student_email: string;
  score: number;
  passed_tests: number;
  total_tests: number;
  questions_submitted: number;
  submitted_at: string | null;
}

@Component({
  selector: "app-coding-results",
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: "./coding-results.component.html",
  styleUrls: ["./coding-results.component.css"],
})
export class CodingResultsComponent implements OnInit {
  private readonly apiBase = "http://localhost:8000/api";
  results: CodingResult[] = [];
  loading = false;
  error = "";
  search = "";
  sort = "score";
  jobFilter = "all";

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.load();
  }

  private headers(): HttpHeaders {
    const token =
      localStorage.getItem("access_token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("token");
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  load(): void {
    this.loading = true;
    this.error = "";
    this.http
      .get<{
        total: number;
        results: CodingResult[];
      }>(`${this.apiBase}/coding-assessment/results`, {
        headers: this.headers(),
      })
      .subscribe({
        next: (data) => {
          this.results = Array.isArray(data?.results) ? data.results : [];
          this.loading = false;
        },
        error: (err) => {
          this.error =
            err?.error?.detail || "Could not load coding assessment results.";
          this.loading = false;
        },
      });
  }

  get averageScore(): number {
    return this.results.length
      ? this.results.reduce((sum, item) => sum + item.score, 0) /
          this.results.length
      : 0;
  }
  get highScoreCount(): number {
    return this.results.filter((item) => item.score >= 80).length;
  }

  get jobs(): string[] {
    return [...new Set(this.results.map((x) => x.job_title))].sort();
  }

  get filtered(): CodingResult[] {
    const q = this.search.trim().toLowerCase();
    const rows = this.results.filter(
      (r) =>
        (!q ||
          [
            r.student_name,
            r.student_email,
            r.job_title,
            String(r.student_id),
          ].some((v) => v.toLowerCase().includes(q))) &&
        (this.jobFilter === "all" || r.job_title === this.jobFilter),
    );
    return rows.sort((a, b) => {
      if (this.sort === "name")
        return a.student_name.localeCompare(b.student_name);
      if (this.sort === "newest")
        return (b.submitted_at || "").localeCompare(a.submitted_at || "");
      if (this.sort === "tests") return b.passed_tests - a.passed_tests;
      return b.score - a.score || b.passed_tests - a.passed_tests;
    });
  }

  date(value: string | null): string {
    return value ? new Date(value).toLocaleString() : "—";
  }

  refresh(): void {
    this.load();
  }
}
