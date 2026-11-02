import { Component, OnInit } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";

interface AdminUser {
  id?: number | string;
  user_id?: number | string;
  ID?: number | string;
  pk?: number | string;
  full_name?: string;
  name?: string;
  username?: string;
  email?: string;
  role?: string;
  is_active?: boolean;
  is_verified?: boolean;
  status?: string;
  [key: string]: unknown;
}

@Component({
  selector: "app-users",
  templateUrl: "./users.component.html",
  styleUrls: ["./users.component.css"],
})
export class UsersComponent implements OnInit {
  users: AdminUser[] = [];
  loading = false;
  errorMessage = "";

  // IMPORTANT: Replace this with the real endpoint from your FastAPI backend.
  private readonly apiUrl = "http://localhost:8000/api/admin/users";

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.errorMessage = "";

    const token =
      localStorage.getItem("access_token") || localStorage.getItem("token");

    let headers = new HttpHeaders();

    if (token) {
      headers = headers.set("Authorization", `Bearer ${token}`);
    }

    this.http.get<unknown>(this.apiUrl, { headers }).subscribe({
      next: (response: unknown) => {
        console.log("Admin users API response:", response);

        let data: unknown = response;

        if (!Array.isArray(data) && data && typeof data === "object") {
          const result = data as Record<string, unknown>;

          data =
            result["users"] ??
            result["items"] ??
            result["results"] ??
            result["data"] ??
            [];
        }

        if (!Array.isArray(data)) {
          this.users = [];
          this.errorMessage = "The API response does not contain a users list.";
          this.loading = false;
          return;
        }

        this.users = data as AdminUser[];
        this.loading = false;

        if (this.users.length === 0) {
          this.errorMessage = "No users were returned by the API.";
        }
      },
      error: (error) => {
        console.error("Failed to load admin users:", error);

        this.errorMessage =
          error.status === 401 || error.status === 403
            ? "You are not authorized to view users. Please sign in again."
            : `Unable to load users (HTTP ${error.status || "error"}). Check the API endpoint.`;

        this.loading = false;
      },
    });
  }

  getUserId(user: AdminUser): number | string {
    const possibleId =
      user.id ??
      user.user_id ??
      user.ID ??
      user.pk ??
      user["userId"] ??
      user["_id"];

    if (typeof possibleId === "string" || typeof possibleId === "number") {
      return possibleId;
    }

    return "ID unavailable";
  }

  getUserName(user: AdminUser): string {
    return user.full_name || user.name || user.username || "N/A";
  }

  getUserStatus(user: AdminUser): string {
    if (user.status) {
      return user.status;
    }

    return user.is_active === false ? "Inactive" : "Active";
  }

  trackByUserId(index: number, user: AdminUser): number | string {
    const id = this.getUserId(user);
    return id === "ID unavailable" ? index : id;
  }
}
