import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { AuthService } from "../../services/auth.service"; // fix path if needed

@Component({
  selector: "app-verify-otp",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: "./verify-otp.component.html",
  styleUrls: ["./verify-otp.component.css"],
})
export class VerifyOtpComponent implements OnInit, OnDestroy {
  email = "";
  otp = "";
  loading = false;
  error = "";
  info = "";
  cooldown = 60;
  private timer: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
  ) {}

  ngOnInit() {
    this.email = this.route.snapshot.queryParamMap.get("email") || "";
    if (!this.email) {
      this.router.navigate(["/register"]);
      return;
    }
    this.startCooldown();
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }

  startCooldown() {
    this.cooldown = 60;
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.cooldown > 0) this.cooldown--;
      else clearInterval(this.timer);
    }, 1000);
  }

  onOtpInput() {
    this.otp = this.otp.replace(/\D/g, "").slice(0, 6); // digits only
  }

  verify() {
    this.error = "";
    this.info = "";
    if (this.otp.length !== 6) {
      this.error = "Enter the 6-digit code";
      return;
    }
    this.loading = true;
    this.auth.verifyOtp(this.email, this.otp).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(["/login"], { queryParams: { verified: 1 } });
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.detail || "Verification failed";
      },
    });
  }

  resend() {
    if (this.cooldown > 0) return;
    this.error = "";
    this.info = "";
    this.auth.resendOtp(this.email).subscribe({
      next: () => {
        this.info = "A new code has been sent to your email";
        this.otp = "";
        this.startCooldown();
      },
      error: (err) => {
        this.error = err?.error?.detail || "Could not resend code";
      },
    });
  }
}
