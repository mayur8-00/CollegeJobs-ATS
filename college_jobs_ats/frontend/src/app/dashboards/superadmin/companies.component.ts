import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Component, OnInit, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { API_URL } from "../../core/api";

interface Company {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./companies.component.html",
  styleUrl: "./companies.component.css",
})
export class SuperadminCompaniesComponent implements OnInit {
  private http = inject(HttpClient);

  companies: Company[] = [];

  loading = true;
  error = "";

  search = "";
  filter: "all" | "verified" | "pending" = "all";

  ngOnInit(): void {
    this.loadCompanies();
  }

  loadCompanies(): void {
    this.loading = true;
    this.error = "";

    this.http.get<Company[]>(`${API_URL}/dashboard/companies`).subscribe({
      next: (data) => {
        this.companies = data;
        this.loading = false;
      },
      error: (error) => {
        console.error("Companies API error:", error);

        this.error =
          error?.error?.detail || "Unable to load companies. Please try again.";

        this.loading = false;
      },
    });
  }

  get filteredCompanies(): Company[] {
    const search = this.search.trim().toLowerCase();

    return this.companies.filter((company) => {
      const matchesSearch =
        !search ||
        company.name.toLowerCase().includes(search) ||
        company.email.toLowerCase().includes(search);

      const matchesFilter =
        this.filter === "all" ||
        (this.filter === "verified" && company.is_verified) ||
        (this.filter === "pending" && !company.is_verified);

      return matchesSearch && matchesFilter;
    });
  }

  get totalCompanies(): number {
    return this.companies.length;
  }

  get verifiedCompanies(): number {
    return this.companies.filter((c) => c.is_verified).length;
  }

  get pendingCompanies(): number {
    return this.companies.filter((c) => !c.is_verified).length;
  }

  setFilter(value: "all" | "verified" | "pending"): void {
    this.filter = value;
  }

  refresh(): void {
    this.loadCompanies();
  }
}
