import { Component, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { AuthStore } from "../../core/auth/auth.store";
import { UserService } from "../../core/user.service";
import { requestedReturnUrl } from "../../core/auth/auth-redirect";

/**
 * Page d'atterrissage d'un compte authentifié sans rôle applicatif (Role = "user"),
 * ou dont le profil n'a pas pu être chargé (backend injoignable).
 * Évite la boucle /login ↔ / entre guestGuard et homeGuard, et garde la page
 * demandée (`returnUrl`) pour y revenir dès que ça répond.
 */
@Component({
  selector: "app-pending-access",
  templateUrl: "./pending-access.html",
  styleUrl: "../login/login.scss"
})
export class PendingAccess {
  private readonly authStore = inject(AuthStore);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);

  readonly email = this.authStore.currentUser()?.email ?? null;
  /** Profil jamais chargé : le serveur n'a pas répondu (et non un compte sans rôle). */
  readonly unreachable = signal(this.authStore.dbUser() === null);
  readonly checking = signal(false);
  readonly message = signal<string | null>(null);

  /** Recharge le profil DB : si un admin a attribué un rôle entre-temps, on entre. */
  async recheck(): Promise<void> {
    this.checking.set(true);
    this.message.set(null);
    try {
      const user = await this.userService.getMe();
      this.authStore.setDbUser(user);
      this.unreachable.set(false);
      if (user.Role !== "user") {
        await this.router.navigateByUrl(requestedReturnUrl(this.router) ?? "/");
        return;
      }
      this.message.set("Aucun rôle n'a encore été attribué à votre compte.");
    } catch (e) {
      this.message.set((e as Error).message);
    } finally {
      this.checking.set(false);
    }
  }

  async logout(): Promise<void> {
    await this.authStore.logout();
    await this.router.navigate(["/login"]);
  }
}
