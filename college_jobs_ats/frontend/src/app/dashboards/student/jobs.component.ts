import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Router } from "@angular/router";

const API_URL = "http://localhost:8000/api";

interface Job {
  id: number;
  title: string;
  company_name?: string;
  company?: string;
  description?: string;
  location?: string;
  employment_type?: string;
  job_type?: string;
  experience?: string;
  experience_required?: string;
  salary?: string | number;
  salary_range?: string;
  skills?: string[] | string;
  requirements?: string;
  responsibilities?: string;
  status?: string;
  is_active?: boolean;
  created_at?: string;
  deadline?: string;
}

@Component({
  selector: "app-student-jobs",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./jobs.component.html",
  styleUrls: ["./jobs.component.css"],
})
export class StudentJobsComponent implements OnInit {
  jobs: Job[] = [];
  filteredJobs: Job[] = [];

  isLoading = false;
  errorMessage = "";
  successMessage = "";

  searchTerm = "";
  selectedLocation = "";
  selectedJobType = "";
  selectedSort = "newest";

  locations: string[] = [];
  jobTypes: string[] = [];

  isDarkMode = false;

  savedJobs: number[] = [];

  selectedJob: Job | null = null;
  showDetailsModal = false;

  showApplyModal = false;
  applyingJob: Job | null = null;

  selectedResume: File | null = null;
  resumeError = "";
  isSubmitting = false;

  showSuccessModal = false;
  appliedJobId: number | null = null;

  readonly maxResumeSize = 5 * 1024 * 1024;

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadTheme();
    this.loadSavedJobs();
    this.loadJobs();
  }

  // --------------------------------------------------
  // LOAD JOBS
  // --------------------------------------------------

  loadJobs(): void {
    this.isLoading = true;
    this.errorMessage = "";

    this.http.get<any>(`${API_URL}/jobs/`).subscribe({
      next: (response) => {
        let jobList: any[] = [];

        if (Array.isArray(response)) {
          jobList = response;
        } else if (Array.isArray(response?.items)) {
          jobList = response.items;
        } else if (Array.isArray(response?.jobs)) {
          jobList = response.jobs;
        } else if (Array.isArray(response?.data)) {
          jobList = response.data;
        }

        this.jobs = jobList
          .filter((job) => job && job.id != null && job.title)
          .filter((job) => {
            const status = String(job.status || "").toLowerCase();

            return (
              status !== "closed" &&
              status !== "inactive" &&
              status !== "expired" &&
              job.is_active !== false
            );
          });

        this.buildFilterOptions();
        this.applyFilters();

        this.isLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        console.error("Jobs loading error:", error);

        this.errorMessage =
          error.error?.detail ||
          "Unable to load jobs. Please check your connection and try again.";

        this.isLoading = false;
      },
    });
  }

  // --------------------------------------------------
  // FILTER OPTIONS
  // --------------------------------------------------

  buildFilterOptions(): void {
    this.locations = [
      ...new Set(
        this.jobs
          .map((job) => job.location?.trim())
          .filter((value): value is string => !!value),
      ),
    ].sort();

    this.jobTypes = [
      ...new Set(
        this.jobs
          .map((job) => (job.employment_type || job.job_type || "").trim())
          .filter((value) => !!value),
      ),
    ].sort();
  }

  // --------------------------------------------------
  // SEARCH AND FILTER
  // --------------------------------------------------

  applyFilters(): void {
    const search = this.searchTerm.trim().toLowerCase();

    this.filteredJobs = this.jobs.filter((job) => {
      const skillsText = Array.isArray(job.skills)
        ? job.skills.join(" ")
        : job.skills || "";

      const searchableText = [
        job.title,
        job.company_name,
        job.company,
        job.description,
        job.location,
        job.employment_type,
        job.job_type,
        job.experience,
        job.experience_required,
        skillsText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !search || searchableText.includes(search);

      const matchesLocation =
        !this.selectedLocation || job.location === this.selectedLocation;

      const jobType = job.employment_type || job.job_type || "";

      const matchesJobType =
        !this.selectedJobType || jobType === this.selectedJobType;

      return matchesSearch && matchesLocation && matchesJobType;
    });

    this.sortJobs();
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchTerm = "";
    this.selectedLocation = "";
    this.selectedJobType = "";
    this.selectedSort = "newest";

    this.applyFilters();
  }

  // --------------------------------------------------
  // SORTING
  // --------------------------------------------------

  sortJobs(): void {
    if (this.selectedSort === "newest") {
      this.filteredJobs.sort((a, b) => {
        return (
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
        );
      });
    } else if (this.selectedSort === "title") {
      this.filteredJobs.sort((a, b) => a.title.localeCompare(b.title));
    } else if (this.selectedSort === "salary") {
      this.filteredJobs.sort((a, b) => {
        return this.getSalaryValue(b) - this.getSalaryValue(a);
      });
    }
  }

  onSortChange(): void {
    this.applyFilters();
  }

  private getSalaryValue(job: Job): number {
    const salary = job.salary;

    if (typeof salary === "number") {
      return salary;
    }

    const value = String(salary || job.salary_range || "")
      .replace(/,/g, "")
      .match(/\d+(\.\d+)?/);

    return value ? Number(value[0]) : 0;
  }

  // --------------------------------------------------
  // JOB DETAILS MODAL
  // --------------------------------------------------

  openJobDetails(job: Job): void {
    this.selectedJob = job;
    this.showDetailsModal = true;

    this.showApplyModal = false;
    this.applyingJob = null;

    document.body.classList.add("modal-open");
  }

  closeJobDetails(): void {
    this.showDetailsModal = false;
    this.selectedJob = null;

    document.body.classList.remove("modal-open");
  }

  // --------------------------------------------------
  // SAVED JOBS
  // --------------------------------------------------

  loadSavedJobs(): void {
    try {
      const stored = localStorage.getItem("student_saved_jobs");
      this.savedJobs = stored ? JSON.parse(stored) : [];
    } catch {
      this.savedJobs = [];
    }
  }

  isJobSaved(jobId: number): boolean {
    return this.savedJobs.includes(jobId);
  }

  toggleSaveJob(job: Job, event?: Event): void {
    event?.stopPropagation();

    if (this.isJobSaved(job.id)) {
      this.savedJobs = this.savedJobs.filter((id) => id !== job.id);
    } else {
      this.savedJobs.push(job.id);
    }

    localStorage.setItem("student_saved_jobs", JSON.stringify(this.savedJobs));
  }

  // --------------------------------------------------
  // APPLY MODAL
  // --------------------------------------------------

  openApplyModal(job: Job): void {
    this.applyingJob = job;
    this.selectedResume = null;
    this.resumeError = "";

    this.showDetailsModal = false;
    this.showApplyModal = true;

    document.body.classList.add("modal-open");
  }

  closeApplyModal(): void {
    if (this.isSubmitting) {
      return;
    }

    this.showApplyModal = false;
    this.applyingJob = null;
    this.selectedResume = null;
    this.resumeError = "";

    document.body.classList.remove("modal-open");
  }

  // --------------------------------------------------
  // RESUME VALIDATION
  // --------------------------------------------------

  onResumeSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;

    this.selectedResume = null;
    this.resumeError = "";

    if (!file) {
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!["pdf", "docx"].includes(extension || "")) {
      this.resumeError = "Only PDF and DOCX resume files are allowed.";
      input.value = "";
      return;
    }

    if (file.size > this.maxResumeSize) {
      this.resumeError = "Resume file size must not exceed 5 MB.";
      input.value = "";
      return;
    }

    if (file.size === 0) {
      this.resumeError = "The selected resume file is empty.";
      input.value = "";
      return;
    }

    this.selectedResume = file;
  }

  // --------------------------------------------------
  // SUBMIT APPLICATION
  // --------------------------------------------------

  submitApplication(): void {
    if (!this.applyingJob) {
      this.resumeError = "Please select a job.";
      return;
    }

    if (!this.selectedResume) {
      this.resumeError = "Please upload your resume before applying.";
      return;
    }

    if (this.isSubmitting) {
      return;
    }

    const formData = new FormData();

    formData.append("job_id", String(this.applyingJob.id));
    formData.append("resume", this.selectedResume);

    this.isSubmitting = true;
    this.resumeError = "";

    this.http.post<any>(`${API_URL}/applications/`, formData).subscribe({
      next: (response) => {
        this.isSubmitting = false;

        this.appliedJobId = this.applyingJob?.id || null;

        this.showApplyModal = false;
        this.applyingJob = null;
        this.selectedResume = null;

        this.showSuccessModal = true;

        document.body.classList.add("modal-open");

        console.log("Application submitted successfully:", response);
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting = false;

        console.error("Application submission error:", error);

        if (error.status === 409) {
          this.resumeError = "You have already applied for this job.";
        } else if (error.status === 401) {
          this.resumeError = "Your session has expired. Please log in again.";
        } else if (error.status === 413) {
          this.resumeError = "The uploaded file is too large.";
        } else {
          this.resumeError = this.getErrorMessage(error);
        }
      },
    });
  }

  private getErrorMessage(error: HttpErrorResponse): string {
    const detail = error.error?.detail;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail)) {
      return detail
        .map((item: any) => item.msg || JSON.stringify(item))
        .join(", ");
    }

    if (typeof error.error?.message === "string") {
      return error.error.message;
    }

    return "Unable to submit your application. Please try again.";
  }

  // --------------------------------------------------
  // ASSESSMENT NAVIGATION
  // --------------------------------------------------

  goToAssessment(): void {
    if (!this.appliedJobId) {
      return;
    }

    const jobId = this.appliedJobId;

    this.showSuccessModal = false;
    document.body.classList.remove("modal-open");

    this.router.navigate(["/student/assessment", jobId]);
  }

  closeSuccessModal(): void {
    this.showSuccessModal = false;
    this.appliedJobId = null;

    document.body.classList.remove("modal-open");

    this.loadJobs();
  }

  // --------------------------------------------------
  // THEME
  // --------------------------------------------------

  loadTheme(): void {
    this.isDarkMode = localStorage.getItem("student_jobs_theme") === "dark";
  }

  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;

    localStorage.setItem(
      "student_jobs_theme",
      this.isDarkMode ? "dark" : "light",
    );
  }

  // --------------------------------------------------
  // DISPLAY HELPERS
  // --------------------------------------------------

  getCompanyName(job: Job): string {
    return job.company_name || job.company || "Company";
  }

  getJobType(job: Job): string {
    return job.employment_type || job.job_type || "Not specified";
  }

  getExperience(job: Job): string {
    return job.experience || job.experience_required || "Not specified";
  }

  getSalary(job: Job): string {
    const salary = job.salary ?? job.salary_range;

    if (salary === undefined || salary === null || salary === "") {
      return "Not disclosed";
    }

    return String(salary);
  }

  getSkills(job: Job): string[] {
    if (Array.isArray(job.skills)) {
      return job.skills;
    }

    if (typeof job.skills === "string") {
      return job.skills
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean);
    }

    return [];
  }

  getCompanyInitial(job: Job): string {
    return this.getCompanyName(job).charAt(0).toUpperCase();
  }

  trackByJobId(index: number, job: Job): number {
    return job.id;
  }
}
