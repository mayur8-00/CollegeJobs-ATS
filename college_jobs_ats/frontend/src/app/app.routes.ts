import { Routes } from "@angular/router";

import { LoginComponent } from "./auth/login.component";
import { RegisterComponent } from "./auth/register.component";
import { VerifyOtpComponent } from "./auth/verify-otp.component";

import { roleGuard } from "./core/role.guard";
import { ShellComponent } from "./layout/shell.component";
import { FaqComponent } from "./faq/faq.component";

import { AdminJobDetailsComponent } from "./dashboards/admin/job-details.component";

/**
 * Creates a role-protected dashboard shell.
 */
const shell = (roles: string[], children: Routes): Routes[number] => ({
  path:
    roles[0] === "student"
      ? "student"
      : roles[0] === "company"
        ? "company"
        : roles[0],

  component: ShellComponent,
  canActivate: [roleGuard],
  data: { roles },
  children,
});

export const routes: Routes = [
  // =====================================================
  // PUBLIC ROUTES
  // =====================================================

  {
    path: "",
    redirectTo: "login",
    pathMatch: "full",
  },

  {
    path: "login",
    component: LoginComponent,
  },

  {
    path: "register",
    component: RegisterComponent,
  },

  {
    path: "verify-otp",
    component: VerifyOtpComponent,
  },

  {
    path: "faq",
    component: FaqComponent,
  },

  // =====================================================
  // STUDENT ROUTES
  // =====================================================

  shell(
    ["student"],
    [
      {
        path: "",
        redirectTo: "dashboard",
        pathMatch: "full",
      },

      {
        path: "dashboard",
        loadComponent: () =>
          import("./dashboards/student/dashboard.component").then(
            (m) => m.StudentDashboardComponent,
          ),
      },

      {
        path: "jobs",
        loadComponent: () =>
          import("./dashboards/student/jobs.component").then(
            (m) => m.StudentJobsComponent,
          ),
      },

      {
        path: "applications",
        loadComponent: () =>
          import("./dashboards/student/applications.component").then(
            (m) => m.StudentApplicationsComponent,
          ),
      },

      {
        path: "resume-builder",
        loadComponent: () =>
          import("./dashboards/student/resume-builder.component").then(
            (m) => m.ResumeBuilderComponent,
          ),
      },

      {
        path: "coding-assessments",
        loadComponent: () =>
          import("./dashboards/student/coding-assessment-list.component").then(
            (m) => m.CodingAssessmentListComponent,
          ),
      },
      {
        path: "assessment/:jobId",
        loadComponent: () =>
          import("./dashboards/student/assessment.component").then(
            (m) => m.StudentAssessmentComponent,
          ),
      },
      {
        path: "coding-assessment/:jobId",
        loadComponent: () =>
          import("./dashboards/student/coding-assessment.component").then(
            (m) => m.CodingAssessmentComponent,
          ),
      },
    ],
  ),

  // =====================================================
  // COMPANY ROUTES
  // =====================================================

  shell(
    ["company"],
    [
      {
        path: "",
        redirectTo: "dashboard",
        pathMatch: "full",
      },

      {
        path: "dashboard",
        loadComponent: () =>
          import("./dashboards/company/dashboard.component").then(
            (m) => m.CompanyDashboardComponent,
          ),
      },

      {
        path: "jobs",
        loadComponent: () =>
          import("./dashboards/company/jobs.component").then(
            (m) => m.CompanyJobsComponent,
          ),
      },

      {
        path: "applications",
        loadComponent: () =>
          import("./dashboards/company/applications.component").then(
            (m) => m.CompanyApplicationsComponent,
          ),
      },

      {
        path: "coding-results",
        loadComponent: () =>
          import("./dashboards/shared/coding-results.component").then(
            (m) => m.CodingResultsComponent,
          ),
      },

      {
        path: "assessment-results",
        loadComponent: () =>
          import("./dashboards/shared/assessment-results.component").then(
            (m) => m.AssessmentResultsComponent,
          ),
      },
    ],
  ),

  // =====================================================
  // ADMIN ROUTES
  // =====================================================

  shell(
    ["admin"],
    [
      {
        path: "",
        redirectTo: "dashboard",
        pathMatch: "full",
      },

      {
        path: "dashboard",
        loadComponent: () =>
          import("./dashboards/admin/dashboard.component").then(
            (m) => m.AdminDashboardComponent,
          ),
      },

      {
        path: "users",
        loadComponent: () =>
          import("./dashboards/superadmin/users.component").then(
            (m) => m.SuperadminUsersComponent,
          ),
      },

      // Keep the static jobs route before jobs/:jobId.
      {
        path: "jobs",
        loadComponent: () =>
          import("./dashboards/superadmin/jobs.component").then(
            (m) => m.SuperadminJobsComponent,
          ),
      },

      {
        path: "jobs/:jobId",
        component: AdminJobDetailsComponent,
      },

      {
        path: "applications",
        loadComponent: () =>
          import("./dashboards/superadmin/applications.component").then(
            (m) => m.SuperadminApplicationsComponent,
          ),
      },
    ],
  ),

  // =====================================================
  // SUPERADMIN ROUTES
  // =====================================================

  shell(
    ["superadmin"],
    [
      {
        path: "",
        redirectTo: "dashboard",
        pathMatch: "full",
      },

      {
        path: "dashboard",
        loadComponent: () =>
          import("./dashboards/superadmin/dashboard.component").then(
            (m) => m.SuperadminDashboardComponent,
          ),
      },

      {
        path: "users",
        loadComponent: () =>
          import("./dashboards/superadmin/users.component").then(
            (m) => m.SuperadminUsersComponent,
          ),
      },

      {
        path: "companies",
        loadComponent: () =>
          import("./dashboards/superadmin/companies.component").then(
            (m) => m.SuperadminCompaniesComponent,
          ),
      },

      // Keep the static jobs route before jobs/:jobId.
      {
        path: "jobs",
        loadComponent: () =>
          import("./dashboards/superadmin/jobs.component").then(
            (m) => m.SuperadminJobsComponent,
          ),
      },

      {
        path: "jobs/:jobId",
        component: AdminJobDetailsComponent,
      },

      {
        path: "applications",
        loadComponent: () =>
          import("./dashboards/superadmin/applications.component").then(
            (m) => m.SuperadminApplicationsComponent,
          ),
      },

      {
        path: "coding-results",
        loadComponent: () =>
          import("./dashboards/shared/coding-results.component").then(
            (m) => m.CodingResultsComponent,
          ),
      },

      {
        path: "assessment-results",
        loadComponent: () =>
          import("./dashboards/shared/assessment-results.component").then(
            (m) => m.AssessmentResultsComponent,
          ),
      },
    ],
  ),

  // =====================================================
  // FALLBACK
  // =====================================================

  {
    path: "**",
    redirectTo: "login",
  },
];
