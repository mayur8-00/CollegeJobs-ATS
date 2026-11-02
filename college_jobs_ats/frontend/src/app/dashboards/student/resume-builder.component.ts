import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import { API_URL } from "../../core/api";

interface Education {
  degree: string;
  institution: string;
  year: string;
  percentage: string;
}

interface Project {
  title: string;
  description: string;
  technologies: string;
}

interface Experience {
  role: string;
  company: string;
  duration: string;
  description: string;
}

@Component({
  selector: "app-resume-builder",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./resume-builder.component.html",
  styleUrl: "./resume-builder.component.css",
})
export class ResumeBuilderComponent {
  private http = inject(HttpClient);

  personal = {
    fullName: "",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    github: "",
    summary: "",
  };

  educations: Education[] = [
    {
      degree: "",
      institution: "",
      year: "",
      percentage: "",
    },
  ];

  projects: Project[] = [
    {
      title: "",
      description: "",
      technologies: "",
    },
  ];

  experiences: Experience[] = [
    {
      role: "",
      company: "",
      duration: "",
      description: "",
    },
  ];

  skillsText = "";
  selectedTemplate = "modern";

  resumeFile: File | null = null;
  analyzing = false;
  analysisResult: any = null;
  analysisError = "";

  get skills(): string[] {
    return this.skillsText
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean);
  }

  addEducation(): void {
    this.educations.push({
      degree: "",
      institution: "",
      year: "",
      percentage: "",
    });
  }

  removeEducation(index: number): void {
    if (this.educations.length > 1) {
      this.educations.splice(index, 1);
    }
  }

  addProject(): void {
    this.projects.push({
      title: "",
      description: "",
      technologies: "",
    });
  }

  removeProject(index: number): void {
    if (this.projects.length > 1) {
      this.projects.splice(index, 1);
    }
  }

  addExperience(): void {
    this.experiences.push({
      role: "",
      company: "",
      duration: "",
      description: "",
    });
  }

  removeExperience(index: number): void {
    if (this.experiences.length > 1) {
      this.experiences.splice(index, 1);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;

    this.analysisResult = null;
    this.analysisError = "";

    if (!file) {
      this.resumeFile = null;
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!["pdf", "docx"].includes(extension || "")) {
      this.analysisError = "Please upload a PDF or DOCX file.";
      this.resumeFile = null;
      input.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.analysisError = "Resume size must be 5 MB or less.";
      this.resumeFile = null;
      input.value = "";
      return;
    }

    this.resumeFile = file;
  }

  analyzeResume(): void {
    if (!this.resumeFile) {
      this.analysisError = "Please select a PDF or DOCX resume first.";
      return;
    }

    const token =
      localStorage.getItem("access_token") || localStorage.getItem("token");

    const formData = new FormData();

    // Confirm this field name against your FastAPI endpoint signature.
    formData.append("resume", this.resumeFile);

    this.analyzing = true;
    this.analysisError = "";
    this.analysisResult = null;

    this.http
      .post(`${API_URL}/resume-improvement/analyze`, formData, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      .subscribe({
        next: (response) => {
          this.analysisResult = response;
          this.analyzing = false;
        },
        error: (error) => {
          console.error("Resume AI analysis error:", error);

          this.analysisError =
            error?.error?.detail ||
            "Unable to analyze resume. Check the API endpoint, upload field and backend logs.";

          this.analyzing = false;
        },
      });
  }

  downloadResume(): void {
    if (!this.personal.fullName.trim()) {
      alert("Please enter your full name before downloading.");
      return;
    }

    window.print();
  }
}
