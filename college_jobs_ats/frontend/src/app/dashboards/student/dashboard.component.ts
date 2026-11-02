import { CommonModule } from "@angular/common";
import { Component, OnInit, OnDestroy, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Router, RouterModule } from "@angular/router";
import { finalize } from "rxjs";
import { API_URL } from "../../core/api";

interface DashboardStat {
  label: string;
  value: number;
  change: string;
  icon: string;
  color: string;
  route: string;
}

interface RecommendedJob {
  id: number;
  title: string;
  company: string;
  skills: string[];
  workMode: string;
  color: string;
}

interface JobRecord {
  id: number;
  title?: string;
  company_name?: string;
  company?: { name?: string } | string;
  required_skills?: string[] | string;
  skills?: string[] | string;
  location?: string;
  job_type?: string;
  employment_type?: string;
  status?: string;
  is_active?: boolean;
}

interface ApplicationRecord {
  id: number;
  job_id?: number;
  job_title?: string;
  status?: string;
  ats_recommendation?: string | null;
}

@Component({
  selector: "app-student-dashboard",
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: "./dashboard.component.html",
  styleUrls: ["./dashboard.component.css"],
})
export class StudentDashboardComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  studentName = "Student";
  currentDate = new Date();
  currentTime = "";
  isOnline = true;
  loading = false;
  loadError = "";

  private clockInterval?: ReturnType<typeof setInterval>;

  // This page must be registered in app.routes.ts.
  private readonly codingAssessmentsRoute = "/student/coding-assessments";

  stats: DashboardStat[] = [
    {
      label: "Open jobs",
      value: 0,
      change: "Live",
      icon: "💼",
      color: "blue",
      route: "/student/jobs",
    },
    {
      label: "Applications",
      value: 0,
      change: "Live",
      icon: "📄",
      color: "purple",
      route: "/student/applications",
    },
    {
      label: "Selected",
      value: 0,
      change: "Live",
      icon: "✓",
      color: "green",
      route: "/student/applications",
    },
    {
      label: "Recommended jobs",
      value: 0,
      change: "Live",
      icon: "⭐",
      color: "orange",
      route: "/student/jobs",
    },
    {
      label: "Coding assessments",
      value: 0,
      change: "Available",
      icon: "</>",
      color: "pink",
      route: "/student/coding-assessments",
    },
  ];

  stages = [
    { title: "Applied", count: 0, icon: "✓", state: "pending" },
    { title: "Screening", count: 0, icon: "▣", state: "pending" },
    { title: "Interview", count: 0, icon: "▧", state: "pending" },
    { title: "Offer", count: 0, icon: "♧", state: "pending" },
  ];

  recommendedJobs: RecommendedJob[] = [];

  quickActions = [
    {
      title: "Find Jobs",
      subtitle: "Explore opportunities",
      icon: "⌕",
      color: "blue",
      route: "/student/jobs",
    },
    {
      title: "My Applications",
      subtitle: "Track your progress",
      icon: "▤",
      color: "purple",
      route: "/student/applications",
    },
    {
      title: "Resume Builder",
      subtitle: "Create your AI-powered resume",
      icon: "▧",
      color: "green",
      route: "/student/resume-builder",
    },
    {
      title: "Coding Assessments",
      subtitle: "View and complete assessments",
      icon: "</>",
      color: "pink",
      route: "/student/coding-assessments",
    },

    {
      title: "Descriptive Assessment",
      subtitle: "Review and answer descriptive questions",
      icon: "📊",
      color: "blue",
      route: "/student/assessment/",
    },
  ];

  resumeTips = [
    "Keep your resume updated",
    "Highlight your key skills",
    "Add relevant projects",
    "Use clear and simple language",
  ];

  ngOnInit(): void {
    this.loadStudentName();
    this.updateClock();

    this.clockInterval = setInterval(() => {
      this.updateClock();
    }, 60_000);

    this.loadDashboard();
  }

  ngOnDestroy(): void {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }
  }

  loadDashboard(): void {
    this.loading = true;
    this.loadError = "";

    let jobsLoaded = false;
    let applicationsLoaded = false;

    const finishIfDone = (): void => {
      if (jobsLoaded && applicationsLoaded) {
        this.loading = false;
      }
    };

    this.http
      .get<JobRecord[] | { items?: JobRecord[]; jobs?: JobRecord[] }>(
        `${API_URL}/jobs/`,
      )
      .pipe(
        finalize(() => {
          jobsLoaded = true;
          finishIfDone();
        }),
      )
      .subscribe({
        next: (response) => {
          const jobs = Array.isArray(response)
            ? response
            : (response.items ?? response.jobs ?? []);

          const availableJobs = jobs.filter(
            (job) =>
              job.is_active !== false &&
              String(job.status ?? "active").toLowerCase() !== "closed",
          );

          this.stats[0].value = availableJobs.length;
          this.stats[3].value = availableJobs.length;

          this.recommendedJobs = availableJobs.slice(0, 3).map((job, index) => {
            const company =
              typeof job.company === "string"
                ? job.company
                : job.company?.name || job.company_name || "Hiring company";

            const rawSkills = job.required_skills ?? job.skills ?? [];
            const skills = Array.isArray(rawSkills)
              ? rawSkills
              : String(rawSkills)
                  .split(",")
                  .map((skill) => skill.trim())
                  .filter(Boolean);

            return {
              id: job.id,
              title: job.title || "Untitled position",
              company,
              skills: skills.slice(0, 3),
              workMode: job.location || job.job_type || "Not specified",
              color: ["blue", "dark", "green"][index % 3],
            };
          });
        },
        error: (error) => {
          console.error("Student jobs request failed:", error);
          this.loadError =
            "Unable to load jobs. Check that the jobs API is running.";
        },
      });

    this.http
      .get<ApplicationRecord[]>(`${API_URL}/applications/mine`)
      .pipe(
        finalize(() => {
          applicationsLoaded = true;
          finishIfDone();
        }),
      )
      .subscribe({
        next: (response) => {
          const applications = Array.isArray(response) ? response : [];

          const countStatus = (...statuses: string[]) =>
            applications.filter((application) =>
              statuses.includes(
                String(application.status ?? "")
                  .trim()
                  .toLowerCase(),
              ),
            ).length;

          this.stats[1].value = applications.length;
          this.stats[2].value = countStatus("selected");

          const applied = countStatus("applied");
          const screening = countStatus(
            "reviewing",
            "screening",
            "shortlisted",
          );
          const interviews = countStatus("interview", "interview_scheduled");
          const offers = countStatus("selected");

          this.stages = [
            {
              title: "Applied",
              count: applied,
              icon: "✓",
              state: applied > 0 ? "complete" : "pending",
            },
            {
              title: "Screening",
              count: screening,
              icon: "▣",
              state: screening > 0 ? "active" : "pending",
            },
            {
              title: "Interview",
              count: interviews,
              icon: "▧",
              state: interviews > 0 ? "active" : "pending",
            },
            {
              title: "Offer",
              count: offers,
              icon: "♧",
              state: offers > 0 ? "complete" : "pending",
            },
          ];
        },
        error: (error) => {
          console.error("Student applications request failed:", error);
          this.loadError =
            "Unable to load your applications. Check the applications API.";
        },
      });
  }

  private loadStudentName(): void {
    const storedName = localStorage.getItem("user_name");

    if (storedName?.trim()) {
      this.studentName = storedName.trim().split(/\s+/)[0];
      return;
    }

    for (const key of ["collegeJobAuth", "user", "currentUser"]) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;

        const parsed = JSON.parse(raw);
        const name =
          parsed?.user?.name ||
          parsed?.name ||
          parsed?.full_name ||
          parsed?.user?.full_name;

        if (typeof name === "string" && name.trim()) {
          this.studentName = name.trim().split(/\s+/)[0];
          return;
        }
      } catch {
        // Ignore invalid stored JSON.
      }
    }
  }

  private updateClock(): void {
    this.currentDate = new Date();
    this.currentTime = this.currentDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  navigateTo(route: string): void {
    if (!route) return;

    void this.router.navigateByUrl(route).then((navigated) => {
      if (!navigated) {
        console.warn("Angular could not navigate to:", route);
      }
    });
  }

  openJob(jobId: number): void {
    if (!jobId) {
      this.navigateTo("/student/jobs");
      return;
    }

    this.navigateTo("/student/jobs");
  }

  openCodingAssessments(): void {
    this.navigateTo(this.codingAssessmentsRoute);
  }

  private readonly descriptiveAssessmentRoute = "/student/assessment";

  openDescriptiveAssessment(): void {
    this.navigateTo(this.descriptiveAssessmentRoute);
  }

  trackByLabel(_: number, item: DashboardStat): string {
    return item.label;
  }

  trackByJob(_: number, item: RecommendedJob): number {
    return item.id;
  }
}
