import { CommonModule } from "@angular/common";
import { Component, OnInit, inject } from "@angular/core";
import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Router } from "@angular/router";
import { API_URL } from "../../core/api";

interface StudentApplication {
  id: number | string;
  job_id?: number | string;
  job_title?: string;
  status?: string;
  coding_assessment_status?: string;
  assessment_status?: string;
}

@Component({
  selector: "app-coding-assessment-list",
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="assessment-page">
      <header class="page-header">
        <div class="header-content">
          <span class="eyebrow">STUDENT WORKSPACE</span>
          <h1>Coding Assessments</h1>
          <p>
            Complete descriptive assessments for the jobs you have applied to.
          </p>
        </div>

        <button class="back-button" type="button" (click)="goBack()">
          ← Dashboard
        </button>
      </header>

      <section class="summary-card">
        <div class="summary-icon">&lt;/&gt;</div>
        <div>
          <span class="summary-label">YOUR ASSESSMENTS</span>
          <h2>Showcase your skills</h2>
          <p>Read each question carefully and submit your own explanations.</p>
        </div>
        <div class="summary-count">
          <strong>{{ applications.length }}</strong>
          <span>Applications</span>
        </div>
      </section>

      <div class="message loading-message" *ngIf="loading">
        <span class="spinner"></span>
        <p>Loading your applications...</p>
      </div>

      <div class="message error-message" *ngIf="error" role="alert">
        <div>
          <strong>Unable to load assessments</strong>
          <p>{{ error }}</p>
        </div>
        <button type="button" class="retry-button" (click)="loadApplications()">
          Try again
        </button>
      </div>

      <ng-container *ngIf="!loading && !error">
        <div class="section-heading" *ngIf="applications.length > 0">
          <div>
            <h2>Your applications</h2>
            <p>Choose an application to view its assessment.</p>
          </div>
          <button type="button" class="find-jobs-button" (click)="findJobs()">
            + Find jobs
          </button>
        </div>

        <div class="assessment-list" *ngIf="applications.length > 0">
          <article
            class="assessment-card"
            *ngFor="let app of applications; trackBy: trackByApplicationId"
          >
            <div class="assessment-icon">&lt;/&gt;</div>

            <div class="assessment-info">
              <span class="card-label">JOB APPLICATION</span>

              <h3>
                {{ app.job_title || "Job application #" + app.id }}
              </h3>

              <div class="status-row">
                <span class="status-label">Application</span>
                <span
                  class="status-badge"
                  [ngClass]="getStatusClass(app.status)"
                >
                  {{ formatStatus(app.status || "Pending") }}
                </span>
              </div>

              <div class="status-row">
                <span class="status-label">Assessment</span>
                <span
                  class="assessment-status"
                  [ngClass]="
                    getStatusClass(
                      app.coding_assessment_status || app.assessment_status
                    )
                  "
                >
                  {{
                    formatStatus(
                      app.coding_assessment_status ||
                        app.assessment_status ||
                        "Check availability"
                    )
                  }}
                </span>
              </div>
            </div>

            <div class="card-action">
              <button
                type="button"
                class="start-button"
                [disabled]="!app.job_id"
                (click)="startAssessment(app)"
              >
                Open assessment
                <span aria-hidden="true">→</span>
              </button>

              <small *ngIf="!app.job_id">
                Job ID unavailable for this application.
              </small>
            </div>
          </article>
        </div>

        <section class="empty-state" *ngIf="applications.length === 0">
          <div class="empty-icon">&lt;/&gt;</div>
          <h2>No applications found</h2>
          <p>
            Apply for a job first. Your applications will appear here when the
            application API returns them.
          </p>
          <button type="button" class="start-button" (click)="findJobs()">
            Explore available jobs →
          </button>
        </section>

        <footer class="page-footer">
          <span class="footer-dot"></span>
          Your student workspace
          <span class="footer-separator">•</span>
          Keep learning and improving your skills.
        </footer>
      </ng-container>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        color: #172033;
      }

      * {
        box-sizing: border-box;
      }

      .assessment-page {
        width: 100%;
        max-width: 1100px;
        margin: 0 auto;
        padding: 12px 0 32px;
      }

      .page-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        margin-bottom: 28px;
      }

      .header-content {
        min-width: 0;
      }

      .eyebrow {
        color: #5268dc;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.14em;
      }

      .page-header h1 {
        margin: 9px 0;
        color: #15213a;
        font-size: clamp(27px, 4vw, 36px);
        font-weight: 800;
        letter-spacing: -0.04em;
      }

      .page-header p {
        margin: 0;
        color: #69758b;
        font-size: 14px;
        line-height: 1.7;
      }

      .back-button,
      .find-jobs-button,
      .start-button,
      .retry-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
        min-height: 44px;
        padding: 11px 16px;
        border: 0;
        border-radius: 11px;
        font-size: 13px;
        font-weight: 750;
        cursor: pointer;
        transition:
          transform 0.2s ease,
          background 0.2s ease,
          box-shadow 0.2s ease;
      }

      .back-button {
        flex-shrink: 0;
        color: #3346a5;
        background: #e9edff;
      }

      .back-button:hover,
      .find-jobs-button:hover {
        background: #dce3ff;
      }

      .summary-card {
        display: flex;
        align-items: center;
        gap: 19px;
        margin-bottom: 30px;
        padding: 25px;
        overflow: hidden;
        color: #fff;
        background: linear-gradient(120deg, #14213e, #294579);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 20px;
        box-shadow: 0 16px 35px rgba(26, 45, 84, 0.12);
      }

      .summary-icon {
        display: grid;
        flex: 0 0 58px;
        width: 58px;
        height: 58px;
        place-items: center;
        color: #d8e5ff;
        background: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.13);
        border-radius: 16px;
        font-size: 20px;
        font-weight: 800;
      }

      .summary-card > div:nth-child(2) {
        flex: 1;
        min-width: 0;
      }

      .summary-label {
        color: #b9d0ff;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.13em;
      }

      .summary-card h2 {
        margin: 6px 0;
        font-size: 22px;
        font-weight: 800;
      }

      .summary-card p {
        margin: 0;
        color: #d3dced;
        font-size: 13px;
        line-height: 1.7;
      }

      .summary-count {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-width: 90px;
        padding-left: 22px;
        border-left: 1px solid rgba(255, 255, 255, 0.2);
      }

      .summary-count strong {
        font-size: 30px;
        line-height: 1.2;
      }

      .summary-count span {
        margin-top: 5px;
        color: #c8d6ef;
        font-size: 11px;
      }

      .section-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 15px;
        margin-bottom: 17px;
      }

      .section-heading h2 {
        margin: 0 0 5px;
        color: #19253d;
        font-size: 19px;
        font-weight: 800;
      }

      .section-heading p {
        margin: 0;
        color: #78849a;
        font-size: 13px;
      }

      .find-jobs-button {
        color: #3d4fc2;
        background: #edf0ff;
      }

      .assessment-list {
        display: grid;
        gap: 16px;
      }

      .assessment-card {
        display: flex;
        align-items: center;
        gap: 19px;
        min-width: 0;
        padding: 23px;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 17px;
        box-shadow: 0 7px 22px rgba(15, 23, 42, 0.035);
        transition:
          border-color 0.2s ease,
          transform 0.2s ease,
          box-shadow 0.2s ease;
      }

      .assessment-card:hover {
        border-color: #c9d3ff;
        box-shadow: 0 12px 30px rgba(37, 54, 110, 0.08);
        transform: translateY(-2px);
      }

      .assessment-icon {
        display: grid;
        flex: 0 0 54px;
        width: 54px;
        height: 54px;
        place-items: center;
        color: #4c58c9;
        background: #edf0ff;
        border-radius: 15px;
        font-size: 17px;
        font-weight: 800;
      }

      .assessment-info {
        flex: 1;
        min-width: 0;
      }

      .card-label {
        color: #77839b;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.12em;
      }

      .assessment-info h3 {
        margin: 7px 0 13px;
        color: #1b2942;
        font-size: 18px;
        font-weight: 800;
        overflow-wrap: anywhere;
      }

      .status-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 9px;
        margin-top: 8px;
      }

      .status-label {
        color: #7b879c;
        font-size: 12px;
      }

      .status-badge,
      .assessment-status {
        display: inline-flex;
        align-items: center;
        max-width: 100%;
        padding: 5px 9px;
        border-radius: 7px;
        font-size: 11px;
        font-weight: 750;
        overflow-wrap: anywhere;
      }

      .status-pending {
        color: #94620a;
        background: #fff5d9;
      }

      .status-approved,
      .status-completed {
        color: #087b50;
        background: #dcfce9;
      }

      .status-rejected,
      .status-failed {
        color: #b42335;
        background: #ffe5e7;
      }

      .status-default {
        color: #526078;
        background: #edf1f7;
      }

      .card-action {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
        flex-shrink: 0;
      }

      .start-button {
        color: #fff;
        background: #4b4ed1;
        box-shadow: 0 5px 12px rgba(75, 78, 209, 0.16);
      }

      .start-button:hover:not(:disabled) {
        background: #373bb5;
        box-shadow: 0 8px 18px rgba(75, 78, 209, 0.22);
        transform: translateY(-1px);
      }

      .start-button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
        box-shadow: none;
      }

      .card-action small {
        max-width: 180px;
        color: #9a6470;
        font-size: 10px;
        text-align: right;
      }

      .message {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 28px;
        background: #fff;
        border: 1px solid #e4e9f2;
        border-radius: 15px;
      }

      .loading-message {
        flex-direction: column;
        color: #67748b;
      }

      .loading-message p {
        margin: 0;
        font-size: 13px;
      }

      .spinner {
        width: 30px;
        height: 30px;
        border: 3px solid #e4e8ff;
        border-top-color: #4b4ed1;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      .error-message {
        justify-content: space-between;
        color: #a92836;
        background: #fff4f4;
        border-color: #ffd6d9;
      }

      .error-message strong {
        font-size: 14px;
      }

      .error-message p {
        margin: 5px 0 0;
        font-size: 13px;
      }

      .retry-button {
        flex-shrink: 0;
        color: #fff;
        background: #b83243;
      }

      .empty-state {
        padding: 48px 22px;
        text-align: center;
        background: #fff;
        border: 1px dashed #cfd8e8;
        border-radius: 18px;
      }

      .empty-icon {
        display: grid;
        width: 64px;
        height: 64px;
        margin: 0 auto 18px;
        place-items: center;
        color: #4b4ed1;
        background: #edf0ff;
        border-radius: 18px;
        font-size: 21px;
        font-weight: 800;
      }

      .empty-state h2 {
        margin: 0 0 9px;
        color: #1b2942;
        font-size: 22px;
      }

      .empty-state p {
        max-width: 440px;
        margin: 0 auto 22px;
        color: #738097;
        font-size: 14px;
        line-height: 1.8;
      }

      .page-footer {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-top: 26px;
        color: #8792a6;
        font-size: 11px;
      }

      .footer-dot {
        width: 7px;
        height: 7px;
        background: #22c984;
        border-radius: 50%;
      }

      .footer-separator {
        color: #bdc5d3;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 760px) {
        .assessment-page {
          padding-top: 4px;
        }

        .assessment-card {
          align-items: flex-start;
          flex-wrap: wrap;
          padding: 18px;
        }

        .assessment-info {
          flex-basis: calc(100% - 75px);
        }

        .card-action {
          width: 100%;
          align-items: stretch;
          margin-top: 4px;
        }

        .card-action small {
          max-width: none;
          text-align: left;
        }

        .start-button {
          width: 100%;
          min-height: 46px;
        }
      }

      @media (max-width: 480px) {
        .page-header {
          align-items: flex-start;
          flex-direction: column;
        }

        .back-button {
          width: 100%;
        }

        .summary-card {
          align-items: flex-start;
          flex-wrap: wrap;
          padding: 19px;
        }

        .summary-card > div:nth-child(2) {
          flex-basis: calc(100% - 80px);
        }

        .summary-card h2 {
          font-size: 19px;
        }

        .summary-count {
          flex-direction: row;
          justify-content: flex-start;
          gap: 10px;
          width: 100%;
          padding: 14px 0 0;
          border-top: 1px solid rgba(255, 255, 255, 0.2);
          border-left: 0;
        }

        .summary-count strong {
          font-size: 23px;
        }

        .summary-count span {
          margin-top: 0;
        }

        .section-heading {
          align-items: flex-start;
          flex-direction: column;
        }

        .find-jobs-button {
          width: 100%;
        }

        .error-message {
          align-items: stretch;
          flex-direction: column;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          animation-duration: 0.01ms !important;
          transition-duration: 0.01ms !important;
        }
      }
    `,
  ],
})
export class CodingAssessmentListComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  applications: StudentApplication[] = [];
  loading = false;
  error = "";

  ngOnInit(): void {
    this.loadApplications();
  }

  loadApplications(): void {
    this.loading = true;
    this.error = "";

    this.http
      .get<StudentApplication[]>(`${API_URL}/applications/mine`)
      .subscribe({
        next: (response) => {
          this.applications = Array.isArray(response) ? response : [];
          this.loading = false;
        },
        error: (err: HttpErrorResponse) => {
          console.error("Unable to load student applications:", err);

          if (err.status === 401 || err.status === 403) {
            this.error = "Your session may have expired. Please sign in again.";
          } else {
            this.error =
              "Could not load your applications. Check the API connection and try again.";
          }

          this.loading = false;
        },
      });
  }

  startAssessment(app: StudentApplication): void {
    if (app.job_id === undefined || app.job_id === null || app.job_id === "") {
      return;
    }

    void this.router.navigate(["/student/coding-assessment", app.job_id]);
  }

  findJobs(): void {
    void this.router.navigateByUrl("/student/jobs");
  }

  goBack(): void {
    void this.router.navigateByUrl("/student/dashboard");
  }

  trackByApplicationId(
    _index: number,
    app: StudentApplication,
  ): number | string {
    return app.id;
  }

  formatStatus(status: string): string {
    return status
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  getStatusClass(status?: string): string {
    const normalized = (status || "").toLowerCase();

    if (
      ["approved", "accepted", "selected"].some((value) =>
        normalized.includes(value),
      )
    ) {
      return "status-approved";
    }

    if (
      ["completed", "submitted", "passed"].some((value) =>
        normalized.includes(value),
      )
    ) {
      return "status-completed";
    }

    if (
      ["rejected", "failed", "declined"].some((value) =>
        normalized.includes(value),
      )
    ) {
      return "status-rejected";
    }

    if (
      ["pending", "in progress", "available"].some((value) =>
        normalized.includes(value),
      )
    ) {
      return "status-pending";
    }

    return "status-default";
  }
}
