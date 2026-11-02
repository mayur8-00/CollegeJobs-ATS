import { Component, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { API_URL } from "../../core/api";

interface User {
  id?: number;
  name?: string;
  email?: string;
  role?: string;
  is_active?: boolean;
}

@Component({
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./users.component.html",
  styleUrl: "./users.component.css",
})
export class SuperadminUsersComponent implements OnInit {
  private http = inject(HttpClient);

  users: User[] = [];
  error = "";
  loading = true;

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.error = "";

    this.http.get<User[]>(`${API_URL}/dashboard/users`).subscribe({
      next: (response) => {
        this.users = Array.isArray(response) ? response : [];
        this.loading = false;
      },
      error: (e) => {
        console.error("Users API error:", e);

        this.error =
          e?.error?.detail || "Could not load users. Please try again.";

        this.users = [];
        this.loading = false;
      },
    });
  }

  trackByUser(index: number, user: User): number {
    return user.id ?? index;
  }
}
