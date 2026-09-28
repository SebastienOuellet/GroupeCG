import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { AuthStore } from "../../core/auth/auth.store";
import { requestedReturnUrl } from "../../core/auth/auth-redirect";

@Component({
  selector: "app-login",
  imports: [FormsModule],
  templateUrl: "./login.html",
  styleUrl: "./login.scss"
})
export class Login {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  readonly configError = this.authStore.configError;

  email = "";
  password = "";
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async onSubmit(): Promise<void> {
    this.error.set(null);
    this.loading.set(true);
    try {
      await this.authStore.login(this.email, this.password);
      // Retour à la page demandée avant la redirection vers /login.
      await this.router.navigateByUrl(requestedReturnUrl(this.router) ?? "/");
    } catch {
      this.error.set("Courriel ou mot de passe invalide.");
    } finally {
      this.loading.set(false);
    }
  }
}
