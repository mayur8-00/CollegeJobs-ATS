import { CommonModule } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";

interface Job {
  id: number;
  title: string;
  description: string;
  location?: string;
  skills?: string | string[];
  salary?: string | number;
  company_id?: number;
}

@Component({
  selector: "app-company-jobs",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./jobs.component.html",
  styleUrl: "./jobs.component.css",
})
export class CompanyJobsComponent implements OnInit {
  private readonly apiUrl = "http://localhost:8000/api/jobs/";

  jobs: Job[] = [];
  searchTerm = "";
  activeFilter: "all" | "active" = "all";

  loading = false;
  submitting = false;
  deletingId: number | null = null;
  showForm = true;
  notice = "";
  noticeType: "success" | "error" = "success";

  skillInput = "";
  skills: string[] = [];

  form = {
    title: "",
    description: "",
    location: "",
    salary: "",
  };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadJobs();
  }

  loadJobs(): void {
    this.loading = true;

    this.http.get<Job[]>(this.apiUrl).subscribe({
      next: (response) => {
        this.jobs = Array.isArray(response)
          ? response
          : ((response as any)?.items ?? (response as any)?.jobs ?? []);

        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.showNotice(
          error?.error?.detail ||
            "Unable to load jobs. Check your backend connection.",
          "error",
        );
      },
    });
  }

  get filteredJobs(): Job[] {
    const query = this.searchTerm.trim().toLowerCase();

    return this.jobs.filter((job) => {
      const matchesSearch = [
        job.title,
        job.description,
        job.location,
        this.skillsText(job.skills),
      ].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(query),
      );

      return matchesSearch;
    });
  }

  get totalJobs(): number {
    return this.jobs.length;
  }

  get totalSkills(): number {
    return this.jobs.reduce(
      (total, job) => total + this.skillsArray(job.skills).length,
      0,
    );
  }

  addSkill(): void {
    const value = this.skillInput.trim();

    if (!value) return;

    const exists = this.skills.some(
      (skill) => skill.toLowerCase() === value.toLowerCase(),
    );

    if (!exists) this.skills.push(value);

    this.skillInput = "";
  }

  removeSkill(skill: string): void {
    this.skills = this.skills.filter((item) => item !== skill);
  }

  onSkillKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      this.addSkill();
    }
  }

  createJob(): void {
    if (this.submitting) return;

    if (
      !this.form.title.trim() ||
      !this.form.description.trim() ||
      !this.form.location.trim()
    ) {
      this.showNotice(
        "Please fill in the job title, description, and location.",
        "error",
      );
      return;
    }

    this.submitting = true;
    this.notice = "";

    const payload = {
      title: this.form.title.trim(),
      description: this.form.description.trim(),
      location: this.form.location.trim(),
      skills: this.skills.join(", "),
      salary: this.form.salary.trim(),
    };

    this.http.post(this.apiUrl, payload).subscribe({
      next: () => {
        this.submitting = false;
        this.resetForm();
        this.showNotice("Your job has been published successfully!", "success");
        this.loadJobs();
      },
      error: (error) => {
        this.submitting = false;
        this.showNotice(
          error?.error?.detail ||
            "Could not create the job. Check your API payload and backend logs.",
          "error",
        );
      },
    });
  }

  deleteJob(job: Job): void {
    if (this.deletingId !== null) return;

    const confirmed = window.confirm(
      `Delete "${job.title}"? This action cannot be undone.`,
    );

    if (!confirmed) return;

    this.deletingId = job.id;

    this.http.delete(`${this.apiUrl}${job.id}`).subscribe({
      next: () => {
        this.deletingId = null;
        this.jobs = this.jobs.filter((item) => item.id !== job.id);
        this.showNotice("Job deleted successfully.", "success");
      },
      error: (error) => {
        this.deletingId = null;
        this.showNotice(
          error?.error?.detail || "Unable to delete this job.",
          "error",
        );
      },
    });
  }

  resetForm(): void {
    this.form = {
      title: "",
      description: "",
      location: "",
      salary: "",
    };
    this.skills = [];
    this.skillInput = "";
  }

  skillsArray(value?: string | string[]): string[] {
    if (Array.isArray(value)) return value;

    return String(value ?? "")
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean);
  }

  skillsText(value?: string | string[]): string {
    return this.skillsArray(value).join(", ");
  }

  trackByJobId(_: number, job: Job): number {
    return job.id;
  }

  private showNotice(message: string, type: "success" | "error"): void {
    this.notice = message;
    this.noticeType = type;
  }
}
