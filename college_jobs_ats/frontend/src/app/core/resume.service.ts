import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { API_URL } from "./api";

@Injectable({ providedIn: "root" })
export class ResumeService {
  private http = inject(HttpClient);

  /**
   * Opens a resume. A plain <a href> cannot send the JWT, so the file is fetched
   * through HttpClient (the interceptor adds the Authorization header) and then
   * shown from an in-memory blob URL.
   */
  open(applicationId: number, filename?: string | null): void {
    const name = filename || `resume_${applicationId}`;
    const isPdf = name.toLowerCase().endsWith(".pdf");

    // Open the tab NOW (inside the click) so popup blockers allow it.
    const tab = isPdf ? window.open("", "_blank") : null;

    this.http
      .get(`${API_URL}/applications/${applicationId}/resume`, {
        responseType: "blob",
      })
      .subscribe({
        next: (blob) => {
          const typed = new Blob([blob], {
            type: isPdf
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          });
          const url = URL.createObjectURL(typed);

          if (isPdf && tab) {
            tab.location.href = url; // PDF: view in the new tab
          } else {
            const a = document.createElement("a"); // DOCX: browsers can't display it, so download
            a.href = url;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            a.remove();
          }
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        },
        error: (err) => {
          tab?.close();
          const status = err?.status;
          alert(
            status === 404
              ? "Resume file not found on the server."
              : status === 403
                ? "You do not have permission to view this resume."
                : status === 401
                  ? "Your session expired. Please log in again."
                  : "Could not open the resume.",
          );
        },
      });
  }
}
