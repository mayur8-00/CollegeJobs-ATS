import { CommonModule } from "@angular/common";
import {
  HttpClient,
  HttpClientModule,
  HttpErrorResponse,
  HttpHeaders,
} from "@angular/common/http";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";

interface TestCaseResult {
  name: string;
  passed: boolean;
  expected?: string;
  actual?: string;
  message?: string;
}

interface CodingQuestion {
  id: number;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  description: string;
  input: string;
  output: string;
  starterCode: Record<string, string>;
}

@Component({
  selector: "app-coding-assessment",
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, RouterLink],
  templateUrl: "./coding-assessment.component.html",
  styleUrls: ["./coding-assessment.component.css"],
})
export class CodingAssessmentComponent implements OnInit, OnDestroy {
  private readonly apiBase = "http://localhost:8000/api";

  jobId = "";
  jobTitle = "Coding assessment";
  selectedLanguage = "python";
  selectedQuestionIndex = 0;
  code = "";

  isRunning = false;
  isSubmitting = false;
  hasRun = false;

  statusMessage = "";
  statusType: "success" | "error" | "info" = "info";

  runResults: TestCaseResult[] = [];
  submissionResult: any = null;

  timeLeftSeconds = 45 * 60;
  timerLabel = "45:00";

  private timerId?: ReturnType<typeof setInterval>;

  readonly languages = [
    { value: "python", label: "Python", extension: ".py" },
    { value: "javascript", label: "JavaScript", extension: ".js" },
    { value: "java", label: "Java", extension: ".java" },
    { value: "csharp", label: "C# (.NET)", extension: ".cs" },
  ];

  readonly questions: CodingQuestion[] = [
    {
      id: 1,
      title: "Two Sum",
      difficulty: "Easy",
      description:
        "Given an array of integers and a target, return the indices of two different numbers whose sum equals the target. Assume exactly one solution exists.",
      input: "nums = [2, 7, 11, 15], target = 9",
      output: "[0, 1]",
      starterCode: {
        python:
          "def two_sum(nums, target):\n    # Write your solution here\n    pass\n\nprint(two_sum([2, 7, 11, 15], 9))",
        javascript:
          "function twoSum(nums, target) {\n  // Write your solution here\n}\n\nconsole.log(twoSum([2, 7, 11, 15], 9));",
        java: "import java.util.*;\n\nclass Main {\n    static int[] twoSum(int[] nums, int target) {\n        // Write your solution here\n        return new int[]{};\n    }\n    public static void main(String[] args) {\n        System.out.println(Arrays.toString(twoSum(new int[]{2,7,11,15}, 9)));\n    }\n}",
        csharp:
          'using System;\n\nclass Program {\n    static int[] TwoSum(int[] nums, int target) {\n        // Write your solution here\n        return Array.Empty<int>();\n    }\n    static void Main() {\n        Console.WriteLine(string.Join(", ", TwoSum(new int[] {2,7,11,15}, 9)));\n    }\n}',
      },
    },
    {
      id: 2,
      title: "First Non-Repeating Character",
      difficulty: "Medium",
      description:
        "Given a string, return the first character that appears exactly once. Return an empty string if every character repeats.",
      input: 's = "swiss"',
      output: '"w"',
      starterCode: {
        python:
          'def first_unique(s):\n    # Write your solution here\n    pass\n\nprint(first_unique("swiss"))',
        javascript:
          'function firstUnique(s) {\n  // Write your solution here\n}\n\nconsole.log(firstUnique("swiss"));',
        java: 'import java.util.*;\n\nclass Main {\n    static String firstUnique(String s) {\n        // Write your solution here\n        return "";\n    }\n    public static void main(String[] args) { System.out.println(firstUnique("swiss")); }\n}',
        csharp:
          'using System;\nusing System.Linq;\n\nclass Program {\n    static string FirstUnique(string s) {\n        // Write your solution here\n        return "";\n    }\n    static void Main() { Console.WriteLine(FirstUnique("swiss")); }\n}',
      },
    },
    {
      id: 3,
      title: "Balanced Brackets",
      difficulty: "Medium",
      description:
        "Return true if every opening bracket has a matching closing bracket in the correct order. Supported brackets: (), [] and {}.",
      input: 's = "{[()]}"',
      output: "true",
      starterCode: {
        python:
          'def is_balanced(s):\n    # Write your solution here\n    pass\n\nprint(is_balanced("{[()]}"))',
        javascript:
          'function isBalanced(s) {\n  // Write your solution here\n}\n\nconsole.log(isBalanced("{[()]}"));',
        java: 'class Main {\n    static boolean isBalanced(String s) {\n        // Write your solution here\n        return false;\n    }\n    public static void main(String[] args) { System.out.println(isBalanced("{[()]}")); }\n}',
        csharp:
          'using System;\n\nclass Program {\n    static bool IsBalanced(string s) {\n        // Write your solution here\n        return false;\n    }\n    static void Main() { Console.WriteLine(IsBalanced("{[()]}")); }\n}',
      },
    },
  ];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.jobId = this.route.snapshot.paramMap.get("jobId") ?? "";

    if (!this.jobId || !Number.isFinite(Number(this.jobId))) {
      this.showStatus("A valid job ID is required.", "error");
      return;
    }

    this.code =
      this.getSavedCode(this.currentQuestion.id) ||
      this.currentQuestion.starterCode[this.selectedLanguage];

    this.loadAssessment();
    this.startTimer();
  }

  ngOnDestroy(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
    }

    this.saveCurrentCode();
  }

  get currentQuestion(): CodingQuestion {
    return this.questions[this.selectedQuestionIndex];
  }

  get completedCount(): number {
    return this.questions.filter((question) => this.hasSavedCode(question.id))
      .length;
  }

  get progressPercent(): number {
    return Math.round(
      ((this.selectedQuestionIndex + 1) / this.questions.length) * 100,
    );
  }

  get passedTests(): number {
    return this.runResults.filter((result) => result.passed).length;
  }

  private getAuthHeaders(): HttpHeaders {
    const token =
      localStorage.getItem("access_token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("token");

    return new HttpHeaders({
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    });
  }

  selectQuestion(index: number): void {
    if (
      index < 0 ||
      index >= this.questions.length ||
      index === this.selectedQuestionIndex
    ) {
      return;
    }

    this.saveCurrentCode();
    this.selectedQuestionIndex = index;

    this.code =
      this.getSavedCode(this.currentQuestion.id) ||
      this.currentQuestion.starterCode[this.selectedLanguage];

    this.runResults = [];
    this.hasRun = false;
    this.statusMessage = "";
  }

  changeLanguage(language: string): void {
    if (!this.languages.some((item) => item.value === language)) {
      return;
    }

    this.saveCurrentCode();
    this.selectedLanguage = language;

    this.code =
      this.getSavedCode(this.currentQuestion.id, language) ||
      this.currentQuestion.starterCode[language];

    this.runResults = [];
    this.hasRun = false;
  }

  onCodeInput(): void {
    this.saveCurrentCode();
    this.hasRun = false;
  }

  preventPaste(event: ClipboardEvent): void {
    event.preventDefault();
    this.showStatus(
      "Pasting is disabled in this editor. Type your solution manually.",
      "info",
    );
  }

  preventDrop(event: DragEvent): void {
    event.preventDefault();
  }

  runCode(): void {
    if (!this.code.trim()) {
      this.showStatus("Write your solution before running the tests.", "error");
      return;
    }

    if (!this.getToken()) {
      this.showStatus(
        "Your session has expired. Please log in again.",
        "error",
      );
      return;
    }

    this.isRunning = true;
    this.runResults = [];
    this.hasRun = false;
    this.saveCurrentCode();

    this.showStatus("Sending code to the assessment runner…", "info");

    this.http
      .post<any>(
        `${this.apiBase}/coding-assessment/run`,
        {
          job_id: Number(this.jobId),
          question_id: this.currentQuestion.id,
          language: this.selectedLanguage,
          source_code: this.code,
        },
        { headers: this.getAuthHeaders() },
      )
      .subscribe({
        next: (response) => {
          this.runResults = Array.isArray(response?.test_results)
            ? response.test_results
            : [];

          this.hasRun = true;

          const passed = this.runResults.filter(
            (result) => result.passed,
          ).length;

          this.showStatus(
            response?.message ||
              `Run complete: ${passed}/${this.runResults.length} tests passed.`,
            "success",
          );

          this.isRunning = false;
        },
        error: (error: HttpErrorResponse) => {
          this.isRunning = false;
          this.showStatus(
            this.apiError(
              error,
              "Code runner endpoint is unavailable. Check your FastAPI backend.",
            ),
            "error",
          );
        },
      });
  }

  submitAssessment(): void {
    if (!this.jobId) {
      this.showStatus("Job ID is missing from the route.", "error");
      return;
    }

    if (!this.getToken()) {
      this.showStatus(
        "Your session has expired. Please log in again.",
        "error",
      );
      return;
    }

    if (!this.code.trim()) {
      this.showStatus("Add code before submitting.", "error");
      return;
    }

    this.saveCurrentCode();
    this.isSubmitting = true;
    this.showStatus("Submitting your assessment…", "info");

    const payload = {
      job_id: Number(this.jobId),
      submissions: this.questions.map((question) => ({
        question_id: question.id,
        language: this.selectedLanguage,
        source_code:
          this.getSavedCode(question.id, this.selectedLanguage) ||
          (question.id === this.currentQuestion.id ? this.code : ""),
      })),
    };

    this.http
      .post<any>(`${this.apiBase}/coding-assessment/submit`, payload, {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (response) => {
          this.submissionResult = response;
          this.isSubmitting = false;

          this.showStatus(
            response?.message || "Assessment submitted for review.",
            "success",
          );
        },
        error: (error: HttpErrorResponse) => {
          this.isSubmitting = false;

          this.showStatus(
            this.apiError(
              error,
              "Submission endpoint is unavailable. Check your FastAPI backend.",
            ),
            "error",
          );
        },
      });
  }

  private loadAssessment(): void {
    this.http
      .get<any>(`${this.apiBase}/coding-assessment/${this.jobId}`, {
        headers: this.getAuthHeaders(),
      })
      .subscribe({
        next: (data) => {
          this.jobTitle = data?.job_title || this.jobTitle;
        },
        error: (error: HttpErrorResponse) => {
          this.showStatus(
            this.apiError(
              error,
              "Could not load assessment details. Sample questions are available locally.",
            ),
            "error",
          );
        },
      });
  }

  private startTimer(): void {
    this.updateTimerLabel();

    this.timerId = setInterval(() => {
      if (this.timeLeftSeconds > 0) {
        this.timeLeftSeconds--;
      }

      this.updateTimerLabel();

      if (this.timeLeftSeconds === 0) {
        if (this.timerId) {
          clearInterval(this.timerId);
        }

        this.showStatus(
          "Time is up. Submit your work if the assessment is still open.",
          "error",
        );
      }
    }, 1000);
  }

  private updateTimerLabel(): void {
    const minutes = Math.floor(this.timeLeftSeconds / 60)
      .toString()
      .padStart(2, "0");

    const seconds = (this.timeLeftSeconds % 60).toString().padStart(2, "0");

    this.timerLabel = `${minutes}:${seconds}`;
  }

  private saveCurrentCode(): void {
    if (!this.jobId || !this.currentQuestion) {
      return;
    }

    this.storeCode(this.currentQuestion.id, this.selectedLanguage, this.code);
  }

  private storageKey(
    questionId: number,
    language = this.selectedLanguage,
  ): string {
    return `coding-assessment:${this.jobId}:${questionId}:${language}`;
  }

  private storeCode(questionId: number, language: string, value: string): void {
    try {
      sessionStorage.setItem(this.storageKey(questionId, language), value);
    } catch {
      // Browser storage may be unavailable.
    }
  }

  private getSavedCode(
    questionId: number,
    language = this.selectedLanguage,
  ): string {
    try {
      return (
        sessionStorage.getItem(this.storageKey(questionId, language)) || ""
      );
    } catch {
      return "";
    }
  }

  hasSavedCode(questionId: number): boolean {
    return this.languages.some((language) =>
      Boolean(this.getSavedCode(questionId, language.value).trim()),
    );
  }

  private getToken(): string | null {
    return (
      localStorage.getItem("access_token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("token")
    );
  }

  private showStatus(
    message: string,
    type: "success" | "error" | "info",
  ): void {
    this.statusMessage = message;
    this.statusType = type;
  }

  private apiError(error: HttpErrorResponse, fallback: string): string {
    if (error.status === 401) {
      return "Not authenticated. Your JWT token may be missing, expired, or rejected by FastAPI. Please log in again and verify the token storage key.";
    }

    if (error.status === 403) {
      return "You do not have permission to access this assessment.";
    }

    return error.error?.detail || error.error?.message || fallback;
  }
}
