import { Component, DestroyRef, HostListener, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { filter } from "rxjs";
import { AuthStore } from "../../../core/auth/auth.store";

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

  /** Menu latéral repliable (mobile/tablette seulement ; toujours visible sur grand écran). */
  readonly menuOpen = signal(false);

  constructor() {
    // Referme le menu après chaque navigation (clic sur un lien du menu sur mobile).
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

  @HostListener("document:keydown.escape")
  closeMenu(): void {
    this.menuOpen.set(false);
  }

  async logout(): Promise<void> {
    await this.authStore.logout();
    await this.router.navigate(["/login"]);
  }
}
