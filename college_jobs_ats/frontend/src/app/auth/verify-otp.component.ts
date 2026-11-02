import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { AuthService } from "../core/auth.service";

@Component({
  selector: "app-verify-otp",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="otp-wrap">
      <div class="otp-card">
        <p class="eyebrow">VERIFY EMAIL</p>
        <h2>Enter your code</h2>
        <p class="sub">
          We sent a 6-digit code to <strong>{{ email }}</strong>
        </p>

        <input
          class="otp-input"
          type="text"
          inputmode="numeric"
          maxlength="6"
          placeholder="000000"
          [(ngModel)]="otp"
          (input)="onOtpInput()"
          (keyup.enter)="verify()"
        />

        <p class="error" *ngIf="error">{{ error }}</p>
        <p class="info" *ngIf="info">{{ info }}</p>

        <button
          class="btn"
          (click)="verify()"
          [disabled]="loading || otp.length !== 6"
        >
          {{ loading ? "Verifying..." : "Verify Email" }}
        </button>

        <p class="resend">
          Didn't get it?
          <button class="link" (click)="resend()" [disabled]="cooldown > 0">
            {{ cooldown > 0 ? "Resend in " + cooldown + "s" : "Resend code" }}
          </button>
        </p>

        <p class="resend"><a routerLink="/register">Wrong email? Go back</a></p>
      </div>
    </div>
  `,
  styles: [
    `
      .otp-wrap {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f8f9fc;
      }
      .otp-card {
        width: 420px;
        max-width: 92%;
        background: #fff;
        padding: 40px 32px;
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
      }
      .eyebrow {
        color: #4f46e5;
        font-weight: 700;
        letter-spacing: 2px;
        font-size: 12px;
        margin: 0 0 8px;
      }
      h2 {
        margin: 0 0 8px;
        color: #0f172a;
      }
      .sub {
        color: #64748b;
        margin-bottom: 24px;
      }
      .otp-input {
        width: 100%;
        box-sizing: border-box;
        text-align: center;
        font-size: 28px;
        letter-spacing: 12px;
        padding: 14px;
        border: 1px solid #dbe1ea;
        border-radius: 12px;
        outline: none;
      }
      .otp-input:focus {
        border-color: #4f46e5;
      }
      .btn {
        width: 100%;
        margin-top: 20px;
        padding: 14px;
        border: 0;
        border-radius: 12px;
        background: #4f46e5;
        color: #fff;
        font-weight: 700;
        cursor: pointer;
      }
      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .error {
        color: #dc2626;
        margin: 12px 0 0;
      }
      .info {
        color: #16a34a;
        margin: 12px 0 0;
      }
      .resend {
        text-align: center;
        color: #64748b;
        margin-top: 16px;
      }
      .link {
        background: none;
        border: 0;
        color: #4f46e5;
        font-weight: 700;
        cursor: pointer;
      }
      .link:disabled {
        color: #94a3b8;
        cursor: not-allowed;
      }
    `,
  ],
})
export class VerifyOtpComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);

  email = "";
  otp = "";
  loading = false;
  error = "";
  info = "";
  cooldown = 60;
  private timer: any;

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
    this.otp = this.otp.replace(/\D/g, "").slice(0, 6);
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
