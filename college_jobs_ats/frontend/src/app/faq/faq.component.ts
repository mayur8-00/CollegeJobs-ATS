import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";

interface FaqItem {
  question: string;
  answer: string;
  category: string;
  icon: string;
}

@Component({
  selector: "app-faq",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./faq.component.html",
  styleUrl: "./faq.component.css",
})
export class FaqComponent {
  searchText = "";
  selectedCategory = "All";
  openIndex: string | null = "student-0";

  categories = [
    "All",
    "Students",
    "Companies",
    "ATS & Resume",
    "Coding Assessments",
    "Account & Security",
  ];

  faqs: FaqItem[] = [
    {
      category: "Students",
      icon: "🎓",
      question: "How do I register as a student?",
      answer:
        "Open the registration page, enter your details, complete email verification if enabled, and sign in to access your student dashboard.",
    },
    {
      category: "Students",
      icon: "💼",
      question: "How can I apply for a job?",
      answer:
        "Visit Find Jobs, select a suitable opening, review its requirements, upload your resume, and submit your application.",
    },
    {
      category: "Students",
      icon: "📊",
      question: "How can I track my job applications?",
      answer:
        "Open your applications dashboard to view the latest status recorded by the recruiting company, such as Applied, Under Review, Shortlisted, Selected, or Rejected.",
    },
    {
      category: "Students",
      icon: "📄",
      question: "Which resume formats can I upload?",
      answer:
        "Your portal should display the formats and file-size limits accepted by the upload form. If your current application feature accepts PDF and DOCX, upload one of those formats.",
    },
    {
      category: "Companies",
      icon: "🏢",
      question: "How do I create a job posting?",
      answer:
        "Sign in with your company account, open the Jobs page, enter the job title, description, location, skills, and other available details, then create the listing.",
    },
    {
      category: "Companies",
      icon: "👥",
      question: "How can I manage applicants?",
      answer:
        "Open the Applications page to review candidates, inspect available resume analysis, and update application statuses according to your hiring process.",
    },
    {
      category: "Companies",
      icon: "⭐",
      question: "Can I compare candidates?",
      answer:
        "Use the available resume scores, skill matches, qualifications, experience information, and coding assessment results to support your comparison. Verify important details before making a hiring decision.",
    },
    {
      category: "Companies",
      icon: "📈",
      question: "Can I view coding assessment results?",
      answer:
        "If coding assessments are enabled for your job, open Coding Results to review submitted answers, test results, and candidate scores.",
    },
    {
      category: "ATS & Resume",
      icon: "🤖",
      question: "What is an Applicant Tracking System?",
      answer:
        "An Applicant Tracking System (ATS) helps recruiters organize applications and compare resume information against job requirements.",
    },
    {
      category: "ATS & Resume",
      icon: "🎯",
      question: "What does my ATS match score mean?",
      answer:
        "The match score estimates how closely the information extracted from your resume aligns with the job criteria used by your portal. It is a screening aid, not a guarantee of selection.",
    },
    {
      category: "ATS & Resume",
      icon: "🧩",
      question: "What are matched and missing skills?",
      answer:
        "Matched skills are skills detected in your resume that overlap with the job requirements. Missing skills are requirements that the system did not detect; they may still be present in your experience but absent from your resume wording.",
    },
    {
      category: "ATS & Resume",
      icon: "🚀",
      question: "How can I improve my resume match?",
      answer:
        "Use clear headings, describe relevant projects, list your actual technical skills, and explain your contributions and results. Never add skills or experience you do not have.",
    },
    {
      category: "Coding Assessments",
      icon: "💻",
      question: "How do coding assessments work?",
      answer:
        "When an assessment is available, select a supported language, write your solution, run the available tests, review the output, and submit your answers before the deadline.",
    },
    {
      category: "Coding Assessments",
      icon: "🧪",
      question: "What happens when a test case fails?",
      answer:
        "Review the expected output, your program output, and any execution or compilation error. Check input handling, edge cases, and output formatting before running your solution again.",
    },
    {
      category: "Coding Assessments",
      icon: "⏱️",
      question: "Can I change my code after running it?",
      answer:
        "You can edit and run your code again while the assessment remains open, subject to the rules and time limits configured by your portal.",
    },
    {
      category: "Account & Security",
      icon: "🔐",
      question: "What if I forget my password?",
      answer:
        "Use the password recovery feature if your portal provides one. Otherwise, contact the portal administrator for assistance.",
    },
    {
      category: "Account & Security",
      icon: "✉️",
      question: "Why do I need to verify my email?",
      answer:
        "Email verification helps confirm access to your email address and can support account security and important application notifications.",
    },
    {
      category: "Account & Security",
      icon: "🛡️",
      question: "How is my account protected?",
      answer:
        "Use a strong, unique password and never share your login credentials. Only access information permitted by your account role, and sign out on shared computers.",
    },
  ];

  get filteredFaqs(): FaqItem[] {
    const query = this.searchText.trim().toLowerCase();

    return this.faqs.filter((faq) => {
      const matchesCategory =
        this.selectedCategory === "All" ||
        faq.category === this.selectedCategory;

      const matchesSearch =
        !query ||
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query) ||
        faq.category.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }

  getCategoryCount(category: string): number {
    if (category === "All") {
      return this.faqs.length;
    }

    return this.faqs.filter((faq) => faq.category === category).length;
  }

  selectCategory(category: string): void {
    this.selectedCategory = category;
    this.openIndex = null;
  }

  toggleFaq(faq: FaqItem): void {
    const index = this.faqs.indexOf(faq);
    const key = `${faq.category}-${index}`;

    this.openIndex = this.openIndex === key ? null : key;
  }

  isOpen(faq: FaqItem): boolean {
    const index = this.faqs.indexOf(faq);
    return this.openIndex === `${faq.category}-${index}`;
  }

  trackFaq(_index: number, faq: FaqItem): string {
    return `${faq.category}-${faq.question}`;
  }

  clearSearch(): void {
    this.searchText = "";
    this.selectedCategory = "All";
    this.openIndex = null;
  }
}
