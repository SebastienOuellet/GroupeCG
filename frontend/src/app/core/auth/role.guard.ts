import { inject } from "@angular/core";
import { CanMatchFn, Router } from "@angular/router";
import { AuthStore } from "./auth.store";
import { UserService } from "../user.service";
import { UserRole } from "../models/user.model";
import { ensureDbUser, loginRedirect, PENDING_ACCESS_PATH, pendingAccessRedirect } from "./auth-redirect";

/**
 * Guard de rôle. À composer APRÈS authGuard dans canMatch.
 * Charge le profil DB (dont le Role) une seule fois si absent du store.
 * Un utilisateur authentifié mais non autorisé est renvoyé vers "/" (qui
 * le redirige vers son propre espace), jamais vers /login : guestGuard le
 * renverrait vers "/" et créerait une boucle.
 */
export const roleGuard = (...allowed: UserRole[]): CanMatchFn => {
  return async () => {
    const authStore = inject(AuthStore);
    const userService = inject(UserService);
    const router = inject(Router);

    if (!(await ensureDbUser(authStore, userService))) {
      return authStore.isAuthenticated() ? pendingAccessRedirect(router) : loginRedirect(router);
    }

    const role = authStore.role();
    if (role && allowed.includes(role)) {
      return true;
    }

    return router.createUrlTree([role === "user" ? PENDING_ACCESS_PATH : "/"]);
  };
};
