import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";

export const roleGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);

  const token = localStorage.getItem("access_token");

  const savedRole = localStorage.getItem("user_role");

  console.log("ROLE GUARD");
  console.log("URL:", state.url);
  console.log("TOKEN:", !!token);
  console.log("ROLE:", savedRole);

  // ---------------------------------------------------------
  // No token → login
  // ---------------------------------------------------------

  if (!token) {
    console.log("ROLE GUARD: No token → login");

    return router.createUrlTree(["/login"]);
  }

  // ---------------------------------------------------------
  // No role → login
  // ---------------------------------------------------------

  if (!savedRole) {
    console.log("ROLE GUARD: No role → login");

    return router.createUrlTree(["/login"]);
  }

  // ---------------------------------------------------------
  // Roles allowed for this route
  // ---------------------------------------------------------

  const allowedRoles = route.data?.["roles"] as string[] | undefined;

  if (!allowedRoles || allowedRoles.length === 0) {
    console.log("ROLE GUARD: No role restriction");

    return true;
  }

  // ---------------------------------------------------------
  // Check role
  // ---------------------------------------------------------

  if (allowedRoles.includes(savedRole)) {
    console.log("ROLE GUARD: ACCESS GRANTED");

    return true;
  }

  // ---------------------------------------------------------
  // Wrong role
  // ---------------------------------------------------------

  console.log("ROLE GUARD: ACCESS DENIED");

  switch (savedRole) {
    case "superadmin":
      return router.createUrlTree(["/superadmin/dashboard"]);

    case "admin":
      return router.createUrlTree(["/admin/dashboard"]);

    case "company":
      return router.createUrlTree(["/company/dashboard"]);

    case "student":
      return router.createUrlTree(["/student/dashboard"]);

    default:
      return router.createUrlTree(["/login"]);
  }
};
