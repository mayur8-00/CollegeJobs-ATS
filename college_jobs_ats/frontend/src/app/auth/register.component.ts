import { Component, ChangeDetectorRef, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { AuthService } from "../core/auth.service";

@Component({
  selector: "app-register",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./register.component.html",
  styleUrl: "./register.component.css",
})
export class RegisterComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  name = "";
  email = "";
  password = "";
  confirmPassword = "";

  error = "";
  success = "";
  loading = false;

  showPassword = false;
  showConfirmPassword = false;

  submit(): void {
    if (this.loading) return;

    this.error = "";
    this.success = "";

    if (!this.name.trim()) {
      this.error = "Please enter your full name.";
      return;
    }

    if (!this.email.trim()) {
      this.error = "Please enter your email address.";
      return;
    }

    if (!this.password) {
      this.error = "Please enter a password.";
      return;
    }

    if (this.password.length < 6) {
      this.error = "Password must contain at least 6 characters.";
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.error = "Passwords do not match.";
      return;
    }

    this.loading = true;

    const data = {
      name: this.name.trim(),
      email: this.email.trim().toLowerCase(),
      password: this.password,
      role: "student",
    };

    this.auth.register(data).subscribe({
      next: () => {
        this.loading = false;
        this.success = "Verification code sent! Check your email...";

        this.cdr.detectChanges();

        // CHANGED: go to the OTP page instead of login
        setTimeout(() => {
          this.router.navigate(["/verify-otp"], {
            queryParams: { email: data.email },
          });
        }, 1000);
      },

      error: (err) => {
        this.loading = false;

        console.error("REGISTRATION ERROR:", err);

        if (err?.status === 409) {
          this.error = "This email is already registered.";
        } else if (err?.status === 429) {
          // NEW: unverified account retried too quickly
          this.error = "Please wait a minute before trying again.";
        } else if (err?.status === 502) {
          // NEW: backend could not send the email
          this.error =
            "Could not send the verification email. Check the address and try again.";
        } else if (err?.status === 400) {
          this.error = err?.error?.detail || "Invalid registration details.";
        } else if (err?.status === 0) {
          this.error =
            "Cannot connect to FastAPI. Make sure the backend is running.";
        } else {
          this.error =
            err?.error?.detail || `Registration failed (HTTP ${err?.status}).`;
        }

        this.cdr.detectChanges();
      },
    });
  }

  goToLogin(): void {
    this.router.navigate(["/login"]);
  }
}