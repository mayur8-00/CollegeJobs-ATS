import { CommonModule } from "@angular/common";
import { Component, OnInit, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { API_URL } from "../../core/api";
import { FormsModule } from "@angular/forms";

interface DescriptiveQuestion {
  id: number | string;
  question: string;
  marks?: number;
}

@Component({
  selector: "app-descriptive-assessment",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main class="assessment-page">
      <a routerLink="/student/dashboard" class="back-link">
        ← Back to Dashboard
      </a>

      <section class="header">
        <span class="eyebrow">STUDENT ASSESSMENT</span>
        <h1>Descriptive Assessment</h1>
        <p>Read each question carefully and write your answers below.</p>
      </section>

      <section class="panel" *ngIf="loading">
        Loading assessment questions...
      </section>

      <section class="panel error" *ngIf="error">
        {{ error }}
        <button type="button" (click)="loadQuestions()">Try Again</button>
      </section>

      <form
        class="panel"
        *ngIf="!loading && !error"
        (ngSubmit)="submitAnswers()"
      >
        <div class="empty" *ngIf="questions.length === 0">
          <h2>No questions available</h2>
          <p>
            There are no descriptive questions to display for this assessment
            yet. Please check again later.
          </p>
        </div>

        <article
          class="question"
          *ngFor="let question of questions; let i = index"
        >
          <div class="question-heading">
            <h2>Question {{ i + 1 }}</h2>
            <span *ngIf="question.marks != null">
              {{ question.marks }} marks
            </span>
          </div>

          <p>{{ question.question }}</p>

          <textarea
            [name]="'answer_' + question.id"
            [(ngModel)]="answers[question.id]"
            [ngModelOptions]="{ standalone: true }"
            rows="6"
            placeholder="Write your answer here..."
            required
          ></textarea>
        </article>

        <button
          class="submit-button"
          type="submit"
          [disabled]="submitting || questions.length === 0"
        >
          {{ submitting ? "Submitting..." : "Submit Answers" }}
        </button>

        <p class="success" *ngIf="successMessage">
          {{ successMessage }}
        </p>
        <p class="error" *ngIf="submitError">{{ submitError }}</p>
      </form>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        color: #172033;
      }
      .assessment-page {
        max-width: 950px;
        margin: 0 auto;
        padding: 30px 20px;
      }
      .back-link {
        color: #4f46e5;
        text-decoration: none;
        font-weight: 600;
      }
      .header {
        margin: 28px 0;
      }
      .eyebrow {
        color: #4f46e5;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 2px;
      }
      h1 {
        margin: 10px 0;
        font-size: clamp(28px, 4vw, 38px);
      }
      .header p,
      .question p,
      .empty p {
        color: #64748b;
        line-height: 1.7;
      }
      .panel {
        padding: 26px;
        margin-bottom: 20px;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        box-shadow: 0 8px 28px #0f172a0a;
      }
      .question {
        padding: 22px 0;
        border-bottom: 1px solid #e2e8f0;
      }
      .question-heading {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
      }
      .question-heading h2 {
        font-size: 18px;
      }
      .question-heading span {
        color: #4f46e5;
        font-size: 13px;
        font-weight: 700;
      }
      textarea {
        box-sizing: border-box;
        width: 100%;
        padding: 14px;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        font: inherit;
        resize: vertical;
      }
      textarea:focus {
        outline: 2px solid #a5b4fc;
        border-color: #6366f1;
      }
      button {
        padding: 12px 18px;
        border: 0;
        border-radius: 9px;
        background: #4f46e5;
        color: white;
        font-weight: 700;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .submit-button {
        margin-top: 24px;
      }
      .error {
        color: #b91c1c;
      }
      .success {
        color: #15803d;
      }
      .empty {
        padding: 20px 0;
      }
      @media (max-width: 600px) {
        .assessment-page {
          padding: 20px 12px;
        }
        .panel {
          padding: 16px;
        }
      }
    `,
  ],
})
export class DescriptiveAssessmentComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);

  questions: DescriptiveQuestion[] = [];
  answers: Record<string, string> = {};
  loading = false;
  submitting = false;
  error = "";
  submitError = "";
  successMessage = "";

  private jobId = "";

  ngOnInit(): void {
    this.jobId = this.route.snapshot.paramMap.get("jobId") ?? "";
    this.loadQuestions();
  }

  loadQuestions(): void {
    if (!this.jobId) {
      this.error = "No job or assessment ID was provided in the URL.";
      return;
    }

    this.loading = true;
    this.error = "";

    // Replace this URL with the actual descriptive-assessment GET endpoint
    // implemented by your FastAPI backend.
    this.http
      .get<any>(`${API_URL}/assessments/${encodeURIComponent(this.jobId)}`)
      .subscribe({
        next: (response) => {
          const items = Array.isArray(response)
            ? response
            : (response?.questions ?? response?.items ?? []);

          this.questions = items
            .map((item: any, index: number) => ({
              id: item.id ?? item._id ?? index + 1,
              question: item.question ?? item.text ?? item.title ?? "",
              marks: item.marks,
            }))
            .filter((item: DescriptiveQuestion) => item.question.trim());

          this.loading = false;
        },
        error: (err) => {
          console.error("Failed to load descriptive assessment:", err);
          this.error =
            "Could not load questions. Verify the assessment API endpoint and server.";
          this.loading = false;
        },
      });
  }

  submitAnswers(): void {
    this.submitting = true;
    this.submitError = "";
    this.successMessage = "";

    const payload = {
      job_id: this.jobId,
      answers: this.questions.map((question) => ({
        question_id: question.id,
        answer: this.answers[question.id]?.trim() ?? "",
      })),
    };

    // Replace this URL with the actual submission endpoint from your backend.
    this.http
      .post(
        `${API_URL}/assessments/${encodeURIComponent(this.jobId)}/submit`,
        payload,
      )
      .subscribe({
        next: () => {
          this.successMessage = "Your answers were submitted successfully.";
          this.submitting = false;
        },
        error: (err) => {
          console.error("Assessment submission failed:", err);
          this.submitError =
            "Submission failed. Check the backend submission endpoint and try again.";
          this.submitting = false;
        },
      });
  }
}
