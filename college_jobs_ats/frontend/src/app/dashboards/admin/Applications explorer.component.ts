import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from "@angular/core";
import { CommonModule, DatePipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import {
  Subject,
  Subscription,
  debounceTime,
  distinctUntilChanged,
} from "rxjs";
import {
  ApplicationPage,
  ApplicationRow,
  AuthService,
} from "../../core/auth.service";

@Component({
  selector: "app-applications-explorer",
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  template: `
    <h2>Applications</h2>

    <div class="tabs">
      <button
        *ngFor="let t of tabs"
        [class.active]="status === t"
        (click)="setStatus(t)"
      >
        {{ t | titlecase }}
        <span>{{ countFor(t) }}</span>
      </button>
    </div>

    <div class="filters">
      <input
        class="search"
        placeholder="Search student, email, job, resume or #id"
        [(ngModel)]="q"
        (ngModelChange)="search$.next($event)"
      />

      <select [(ngModel)]="recommendation" (change)="reload(true)">
        <option value="">Any recommendation</option>
        <option value="selected">Selected</option>
        <option value="review">Review</option>
        <option value="rejected">Rejected</option>
      </select>

      <select [(ngModel)]="minScore" (change)="reload(true)">
        <option [ngValue]="null">Any ATS score</option>
        <option [ngValue]="50">50% and above</option>
        <option [ngValue]="70">70% and above</option>
        <option [ngValue]="85">85% and above</option>
      </select>

      <select [(ngModel)]="sort" (change)="reload(true)">
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="score_high">ATS score: high to low</option>
        <option value="score_low">ATS score: low to high</option>
      </select>

      <button class="clear" (click)="clearFilters()">Clear</button>
    </div>

    <p class="summary" *ngIf="data">
      Showing {{ from }}–{{ to }} of {{ data.total }} applications
    </p>
    <p class="error" *ngIf="message">{{ message }}</p>

    <p *ngIf="loading">Loading…</p>
    <p class="empty" *ngIf="!loading && data && data.items.length === 0">
      No applications match your filters.
    </p>

    <table *ngIf="data && data.items.length">
      <thead>
        <tr>
          <th>#</th>
          <th>Student</th>
          <th>Job</th>
          <th>ATS</th>
          <th>Recommendation</th>
          <th>Status</th>
          <th>Applied</th>
        </tr>
      </thead>
      <tbody>
        <ng-container *ngFor="let a of data.items">
          <tr (click)="toggle(a.id)" class="row">
            <td>{{ a.id }}</td>
            <td>
              <strong>{{ a.student_name }}</strong
              ><br />
              <small>{{ a.student_email }}</small>
            </td>
            <td>{{ a.job_title }}</td>
            <td>
              <span
                class="score"
                [class.good]="(a.ats_score ?? 0) >= 70"
                [class.bad]="(a.ats_score ?? 0) < 50"
                >{{ a.ats_score ?? 0 }}%</span
              >
            </td>
            <td>{{ a.ats_recommendation || "-" }}</td>
            <td>
              <span class="badge {{ a.status }}">{{ a.status }}</span>
            </td>
            <td>{{ a.created_at | date: "dd MMM yyyy" }}</td>
          </tr>

          <tr *ngIf="expanded === a.id" class="details">
            <td colspan="7">
              <div class="scores">
                <span>Skills {{ a.skill_score ?? 0 }}%</span>
                <span>Education {{ a.education_score ?? 0 }}%</span>
                <span>Experience {{ a.experience_score ?? 0 }}%</span>
              </div>

              <div class="skills">
                <b>Matched:</b>
                <span class="chip ok" *ngFor="let s of a.matched_skills">{{
                  s
                }}</span>
                <span *ngIf="!a.matched_skills.length">-</span>
              </div>
              <div class="skills">
                <b>Missing:</b>
                <span class="chip miss" *ngFor="let s of a.missing_skills">{{
                  s
                }}</span>
                <span *ngIf="!a.missing_skills.length">-</span>
              </div>

              <div class="actions">
                <button class="resume" (click)="openResume(a)">
                  View resume{{
                    a.resume_filename ? " (" + a.resume_filename + ")" : ""
                  }}
                </button>
                <span class="sep"></span>
                <button
                  *ngFor="let s of actions"
                  [class]="'act ' + s.value"
                  [disabled]="a.status === s.value || updatingId === a.id"
                  (click)="changeStatus(a, s.value)"
                >
                  {{ s.label }}
                </button>
              </div>
            </td>
          </tr>
        </ng-container>
      </tbody>
    </table>

    <div class="pager" *ngIf="data && data.pages > 1">
      <button [disabled]="page <= 1" (click)="goTo(page - 1)">‹ Prev</button>
      <span>Page {{ page }} of {{ data.pages }}</span>
      <button [disabled]="page >= data.pages" (click)="goTo(page + 1)">
        Next ›
      </button>
      <select [(ngModel)]="pageSize" (change)="reload(true)">
        <option [ngValue]="10">10 / page</option>
        <option [ngValue]="20">20 / page</option>
        <option [ngValue]="50">50 / page</option>
      </select>
    </div>
  `,
  styles: [
    `
      h2 {
        margin: 0 0 16px;
      }
      .tabs {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 14px;
      }
      .tabs button {
        padding: 8px 14px;
        border: 1px solid #dbe1ea;
        border-radius: 999px;
        background: #fff;
        cursor: pointer;
      }
      .tabs button.active {
        background: #4f46e5;
        color: #fff;
        border-color: #4f46e5;
      }
      .tabs span {
        opacity: 0.7;
        margin-left: 4px;
        font-size: 12px;
      }
      .filters {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 12px;
      }
      .filters input,
      .filters select {
        padding: 10px 12px;
        border: 1px solid #dbe1ea;
        border-radius: 10px;
      }
      .search {
        flex: 1;
        min-width: 240px;
      }
      .clear {
        padding: 10px 14px;
        border: 0;
        background: #f1f5f9;
        border-radius: 10px;
        cursor: pointer;
      }
      .summary {
        color: #64748b;
        font-size: 14px;
      }
      .error {
        color: #dc2626;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        background: #fff;
        border-radius: 12px;
        overflow: hidden;
      }
      th {
        text-align: left;
        font-size: 12px;
        color: #64748b;
        padding: 12px;
        background: #f8fafc;
      }
      td {
        padding: 12px;
        border-top: 1px solid #eef2f7;
        vertical-align: top;
      }
      .row {
        cursor: pointer;
      }
      .row:hover {
        background: #f8fafc;
      }
      .details td {
        background: #f8fafc;
        line-height: 1.8;
      }
      .scores {
        display: flex;
        gap: 16px;
        margin-bottom: 8px;
        color: #475569;
        font-size: 14px;
      }
      .chip {
        display: inline-block;
        margin: 2px 4px;
        padding: 2px 10px;
        border-radius: 999px;
        font-size: 12px;
      }
      .chip.ok {
        background: #dcfce7;
      }
      .chip.miss {
        background: #fee2e2;
      }
      .actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
        margin-top: 12px;
      }
      .sep {
        flex: 0 0 12px;
      }
      .actions button {
        padding: 8px 14px;
        border: 1px solid #dbe1ea;
        border-radius: 10px;
        background: #fff;
        cursor: pointer;
      }
      .actions button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .actions .resume {
        background: #eef2ff;
        border-color: #c7d2fe;
      }
      .actions .act.selected {
        background: #dcfce7;
      }
      .actions .act.rejected {
        background: #fee2e2;
      }
      .actions .act.shortlisted {
        background: #fef3c7;
      }
      .score {
        padding: 3px 10px;
        border-radius: 999px;
        background: #fef3c7;
        font-weight: 700;
      }
      .score.good {
        background: #dcfce7;
      }
      .score.bad {
        background: #fee2e2;
      }
      .badge {
        padding: 3px 10px;
        border-radius: 999px;
        background: #e0e7ff;
        font-size: 12px;
        text-transform: capitalize;
      }
      .badge.selected {
        background: #dcfce7;
      }
      .badge.rejected {
        background: #fee2e2;
      }
      .badge.shortlisted {
        background: #fef3c7;
      }
      .pager {
        display: flex;
        gap: 12px;
        align-items: center;
        justify-content: center;
        margin-top: 16px;
      }
      .pager button {
        padding: 8px 14px;
        border: 1px solid #dbe1ea;
        border-radius: 10px;
        background: #fff;
        cursor: pointer;
      }
      .pager button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .empty {
        padding: 40px;
        text-align: center;
        color: #64748b;
      }
    `,
  ],
})
export class ApplicationsExplorerComponent implements OnInit, OnDestroy {
  private api = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  tabs = ["all", "applied", "reviewing", "shortlisted", "selected", "rejected"];

  actions = [
    { label: "Review", value: "reviewing" },
    { label: "Shortlist", value: "shortlisted" },
    { label: "Select", value: "selected" },
    { label: "Reject", value: "rejected" },
  ];

  q = "";
  status = "all";
  recommendation = "";
  minScore: number | null = null;
  sort = "newest";
  page = 1;
  pageSize = 20;

  data: ApplicationPage | null = null;
  loading = false;
  expanded: number | null = null;
  updatingId: number | null = null;
  message = "";

  search$ = new Subject<string>();
  private sub?: Subscription;

  ngOnInit(): void {
    this.sub = this.search$
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => this.reload(true));
    this.reload();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get from(): number {
    return this.data && this.data.total
      ? (this.page - 1) * this.pageSize + 1
      : 0;
  }

  get to(): number {
    return this.data ? Math.min(this.page * this.pageSize, this.data.total) : 0;
  }

  countFor(tab: string): number {
    return this.data ? (this.data.status_counts[tab] ?? 0) : 0;
  }

  reload(resetPage = false, keepExpanded = false): void {
    if (resetPage) this.page = 1;
    this.loading = true;
    this.message = "";
    const keep = this.expanded;

    this.api
      .searchApplications({
        q: this.q,
        status: this.status,
        recommendation: this.recommendation,
        minScore: this.minScore,
        sort: this.sort,
        page: this.page,
        pageSize: this.pageSize,
      })
      .subscribe({
        next: (res) => {
          this.data = res;
          this.loading = false;
          this.expanded = keepExpanded ? keep : null;
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.loading = false;
          this.message = err?.error?.detail || "Could not load applications.";
          this.cdr.detectChanges();
        },
      });
  }

  setStatus(s: string): void {
    this.status = s;
    this.reload(true);
  }

  goTo(p: number): void {
    this.page = p;
    this.reload();
    window.scrollTo({ top: 0 });
  }

  toggle(id: number): void {
    this.expanded = this.expanded === id ? null : id;
  }

  clearFilters(): void {
    this.q = "";
    this.status = "all";
    this.recommendation = "";
    this.minScore = null;
    this.sort = "newest";
    this.reload(true);
  }

  changeStatus(a: ApplicationRow, newStatus: string): void {
    if (newStatus === "rejected" && !confirm(`Reject ${a.student_name}?`))
      return;

    this.updatingId = a.id;
    this.message = "";

    this.api.updateApplicationStatus(a.id, newStatus).subscribe({
      next: () => {
        this.updatingId = null;
        // Reload so tab counts and filters stay correct
        this.reload(false, true);
      },
      error: (err) => {
        this.updatingId = null;
        this.message = err?.error?.detail || "Could not update status.";
        this.cdr.detectChanges();
      },
    });
  }

  openResume(a: ApplicationRow): void {
    this.message = "";
    const isPdf = (a.resume_filename || "").toLowerCase().endsWith(".pdf");

    // Open the tab first so the popup blocker allows it
    const tab = isPdf ? window.open("", "_blank") : null;

    this.api.getResume(a.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        if (isPdf && tab) {
          tab.location.href = url;
        } else {
          const link = document.createElement("a");
          link.href = url;
          link.download = a.resume_filename || "resume";
          link.click();
        }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      },
      error: () => {
        tab?.close();
        this.message = "Could not open the resume file.";
        this.cdr.detectChanges();
      },
    });
  }
}
