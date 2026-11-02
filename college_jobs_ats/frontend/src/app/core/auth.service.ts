import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable, tap } from "rxjs";
import { API_URL } from "./api";

// =========================================================
// TYPES
// =========================================================

export interface User {
  id: number;
  name: string;
  full_name?: string;
  email: string;
  role: "student" | "company" | "superadmin" | "admin";
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role?: string;
}

export interface MessageResponse {
  message: string;
}

export interface ApplicationRow {
  id: number;
  job_id: number;
  job_title: string;
  student_id: number;
  student_name: string;
  student_email: string;
  status: string;
  resume_filename: string | null;
  ats_score: number | null;
  skill_score: number | null;
  education_score: number | null;
  experience_score: number | null;
  ats_recommendation: string | null;
  matched_skills: string[];
  missing_skills: string[];
  ats_notes: string | null;
  created_at: string;
}

export interface ApplicationPage {
  items: ApplicationRow[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  status_counts: Record<string, number>;
}

@Injectable({
  providedIn: "root",
})
export class AuthService {
  private http = inject(HttpClient);

  // =========================================================
  // LOGIN
  // =========================================================

  login(email: string, password: string): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${API_URL}/auth/login`, {
        email: email.trim(),
        password: password,
      })
      .pipe(
        tap((result) => {
          localStorage.setItem("access_token", result.access_token);
          localStorage.setItem("token_type", result.token_type);
        }),
      );
  }

  // =========================================================
  // REGISTER STUDENT (sends an OTP to the email)
  // =========================================================

  register(data: {
    name: string;
    email: string;
    password: string;
    role: string;
  }): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${API_URL}/auth/register`, {
      ...data,
      email: data.email.trim().toLowerCase(),
    });
  }

  // =========================================================
  // VERIFY OTP
  // =========================================================

  verifyOtp(email: string, otp: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${API_URL}/auth/verify-otp`, {
      email: email.trim().toLowerCase(),
      otp: otp.trim(),
    });
  }

  // =========================================================
  // RESEND OTP
  // =========================================================

  resendOtp(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${API_URL}/auth/resend-otp`, {
      email: email.trim().toLowerCase(),
    });
  }

  // =========================================================
  // CURRENT USER
  // =========================================================

  me(): Observable<User> {
    return this.http.get<User>(`${API_URL}/auth/me`);
  }

  // =========================================================
  // APPLICATIONS (admin / superadmin / company)
  // =========================================================

  searchApplications(f: {
    q: string;
    status: string;
    recommendation: string;
    minScore: number | null;
    sort: string;
    page: number;
    pageSize: number;
  }): Observable<ApplicationPage> {
    let p = new HttpParams()
      .set("sort", f.sort)
      .set("page", f.page)
      .set("page_size", f.pageSize);

    if (f.q.trim()) p = p.set("q", f.q.trim());
    if (f.status !== "all") p = p.set("status", f.status);
    if (f.recommendation) p = p.set("recommendation", f.recommendation);
    if (f.minScore !== null) p = p.set("min_score", f.minScore);

    return this.http.get<ApplicationPage>(`${API_URL}/applications/search`, {
      params: p,
    });
  }

  updateApplicationStatus(id: number, newStatus: string) {
    const form = new FormData();
    form.append("new_status", newStatus);
    return this.http.patch(`${API_URL}/applications/${id}/status`, form);
  }

  getResume(id: number): Observable<Blob> {
    return this.http.get(`${API_URL}/applications/${id}/resume`, {
      responseType: "blob",
    });
  }

  // =========================================================
  // TOKEN
  // =========================================================

  token(): string | null {
    return localStorage.getItem("access_token");
  }

  // =========================================================
  // ROLE
  // =========================================================

  getRole(): string | null {
    return localStorage.getItem("user_role");
  }

  // =========================================================
  // SAVE USER
  // =========================================================

  saveUser(user: User): void {
    localStorage.setItem("user_role", String(user.role).trim().toLowerCase());
    localStorage.setItem("user_name", user.full_name || user.name || "User");
    localStorage.setItem("user_email", user.email);
    localStorage.setItem("user_id", String(user.id));
  }

  // =========================================================
  // CHECK LOGIN
  // =========================================================

  isLoggedIn(): boolean {
    return !!this.token();
  }

  // =========================================================
  // LOGOUT
  // =========================================================

  logout(): void {
    localStorage.removeItem("access_token");
    localStorage.removeItem("token_type");

    localStorage.removeItem("user_role");
    localStorage.removeItem("user_name");
    localStorage.removeItem("user_email");
    localStorage.removeItem("user_id");
  }
}
