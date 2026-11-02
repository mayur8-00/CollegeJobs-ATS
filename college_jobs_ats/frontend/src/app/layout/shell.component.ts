import { Component, HostListener, OnDestroy } from "@angular/core";
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
  NavigationEnd,
} from "@angular/router";
import { CommonModule } from "@angular/common";
import { filter, Subscription } from "rxjs";
import { AuthService } from "../core/auth.service";


interface MenuItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: "app-shell",
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: "./shell.component.html",
  styleUrl: "./shell.component.css",
})
export class ShellComponent implements OnDestroy {
  role = localStorage.getItem("user_role") || "";
  name = localStorage.getItem("user_name") || "User";

  mobileOpen = false;
  isMobile = typeof window !== "undefined" && window.innerWidth <= 900;

  // Build once to avoid unnecessary change-detection work.
  menu: MenuItem[] = this.buildMenu();

  private routerSubscription: Subscription;

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {
    this.routerSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.closeMenu());
  }

  get roleLabel(): string {
    if (this.role === "superadmin") {
      return "Super Admin";
    }

    return this.role.charAt(0).toUpperCase() + this.role.slice(1);
  }

  @HostListener("window:resize")
  onWindowResize(): void {
    this.isMobile = typeof window !== "undefined" && window.innerWidth <= 900;

    if (!this.isMobile) {
      this.closeMenu();
    }
  }

  @HostListener("document:keydown.escape")
  onEscapeKey(): void {
    this.closeMenu();
  }

  toggleMenu(): void {
    if (!this.isMobile) {
      return;
    }

    this.mobileOpen = !this.mobileOpen;
  }

  closeMenu(): void {
    this.mobileOpen = false;
  }

  private buildMenu(): MenuItem[] {
    if (this.role === "superadmin") {
      return [
        {
          label: "Overview",
          route: "/superadmin/dashboard",
          icon: "⌂",
        },
        {
          label: "Users",
          route: "/superadmin/users",
          icon: "◎",
        },
        {
          label: "Companies",
          route: "/superadmin/companies",
          icon: "▣",
        },
        {
          label: "Jobs",
          route: "/superadmin/jobs",
          icon: "✦",
        },
        {
          label: "Applications",
          route: "/superadmin/applications",
          icon: "✓",
        },
      ];
    }

    if (this.role === "admin") {
      return [
        {
          label: "Overview",
          route: "/admin/dashboard",
          icon: "⌂",
        },
        {
          label: "Users",
          route: "/admin/users",
          icon: "◎",
        },
        {
          label: "Jobs",
          route: "/admin/jobs",
          icon: "✦",
        },
        {
          label: "Applications",
          route: "/admin/applications",
          icon: "✓",
        },
      ];
    }

    if (this.role === "company") {
      return [
        {
          label: "Overview",
          route: "/company/dashboard",
          icon: "⌂",
        },
        {
          label: "Jobs",
          route: "/company/jobs",
          icon: "✦",
        },
        {
          label: "Applications",
          route: "/company/applications",
          icon: "✓",
        },
      ];
    }

    return [
      {
        label: "Overview",
        route: "/student/dashboard",
        icon: "⌂",
      },
      {
        label: "Find Jobs",
        route: "/student/jobs",
        icon: "⌕",
      },
      {
        label: "My Applications",
        route: "/student/applications",
        icon: "✓",
      },
    ];
  }

  logout(): void {
    this.closeMenu();
    this.auth.logout();
    this.router.navigate(["/login"]);
  }

  ngOnDestroy(): void {
    this.routerSubscription.unsubscribe();
  }
}
