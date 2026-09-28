import { Component, DestroyRef, HostListener, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { filter } from "rxjs";
import { AuthStore } from "../../../core/auth/auth.store";

type NavIcon = "tracking" | "users" | "contract" | "route" | "bell" | "template" | "invoice" | "settings";

interface NavItem {
  path: string;
  label: string;
  icon: NavIcon;
}

/** Clé localStorage : préférence « menu réduit » propre à ce navigateur. */
const COLLAPSED_STORAGE_KEY = "groupecg.sidebarCollapsed";

@Component({
  selector: "app-admin-shell",
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: "./admin-shell.html",
  styleUrl: "./admin-shell.scss"
})
export class AdminShell {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  readonly dbUser = this.authStore.dbUser;

  readonly navItems: readonly NavItem[] = [
    { path: "/clients", label: "Clients", icon: "users" },
    { path: "/contrats", label: "Contrats", icon: "contract" },
    { path: "/routes", label: "Routes", icon: "route" },
    { path: "/suivi", label: "Suivi en direct", icon: "tracking" },
    { path: "/notifications", label: "Notifications", icon: "bell" },
    { path: "/modeles", label: "Modèles", icon: "template" },
    { path: "/factures", label: "Factures", icon: "invoice" },
    { path: "/parametres", label: "Paramètres", icon: "settings" }
  ];

  /** Menu latéral en tiroir (mobile/tablette seulement). */
  readonly menuOpen = signal(false);

  /** Menu réduit aux icônes (grand écran seulement ; ignoré sur mobile). */
  readonly collapsed = signal(readCollapsedPreference());

  constructor() {
    // Referme le tiroir après chaque navigation (clic sur un lien du menu sur mobile).
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef))
      )
      .subscribe(() => this.closeMenu());
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  toggleCollapsed(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
    } catch {
      // Stockage indisponible (navigation privée) : la préférence vaut pour la session seulement.
    }
  }

  @HostListener("document:keydown.escape")
  closeMenu(): void {
    this.menuOpen.set(false);
  }

  async logout(): Promise<void> {
    await this.authStore.logout();
    await this.router.navigate(["/login"]);
  }
}

function readCollapsedPreference(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}
