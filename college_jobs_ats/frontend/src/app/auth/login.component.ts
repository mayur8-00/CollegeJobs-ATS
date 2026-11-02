import { ChangeDetectorRef, Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { switchMap, tap, finalize } from "rxjs";
import { AuthService } from "../core/auth.service";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./login.component.html",
  styleUrl: "./login.component.css",
})
export class LoginComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  email = "";
  password = "";
  error = "";
  info = "";
  loading = false;
  showPassword = false;

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get("verified")) {
      this.info = "Email verified. Please sign in.";
    }
  }

  submit(): void {
    if (this.loading) return;

    this.error = "";
    this.info = "";
    this.loading = true;

    this.auth
      .login(this.email, this.password)
      .pipe(
        switchMap(() => this.auth.me()),
        tap((user) => this.auth.saveUser(user)),
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (user) => {
          const route = this.routeFor(user.role);

          if (route === "/login") {
            this.auth.logout();
            this.error =
              "Your account has no valid role. Contact the administrator.";
            return;
          }

          // Full page load (kept from your original fix for the router stall).
          // Token + role are already in localStorage, so the session survives.
          window.location.assign(route);
        },
        error: (err) => {
          const detail = err?.error?.detail;

          if (err?.status === 0) {
            this.error = "Cannot reach the server. Please try again later.";
          } else if (
            err?.status === 403 &&
            detail === "Please verify your email first"
          ) {
            this.sendToVerification();
          } else if (typeof detail === "string") {
            this.error = detail;
          } else {
            this.error = "Login failed. Please try again.";
          }
        },
      });
  }

  // Unverified account: send a fresh OTP, then open the OTP page
  private sendToVerification(): void {
    const email = this.email.trim().toLowerCase();
    const go = () =>
      this.router.navigate(["/verify-otp"], { queryParams: { email } });

    this.auth.resendOtp(email).subscribe({
      next: go,
      error: go, // e.g. 429 cooldown: the earlier code may still be valid
    });
  }

  goToRegister(): void {
    this.router.navigate(["/register"]);
  }

  private routeFor(role: string): string {
    switch (String(role).trim().toLowerCase()) {
      case "superadmin":
        return "/superadmin/dashboard";
      case "admin":
        return "/admin/dashboard";
      case "company":
        return "/company/dashboard";
      case "student":
        return "/student/dashboard";
      default:
        return "/login";
    }
  }
}
