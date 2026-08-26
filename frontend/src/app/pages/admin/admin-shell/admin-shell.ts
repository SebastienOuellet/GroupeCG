import { Component, inject } from "@angular/core";
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
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

  async logout(): Promise<void> {
    await this.authStore.logout();
    await this.router.navigate(["/login"]);
  }
}
