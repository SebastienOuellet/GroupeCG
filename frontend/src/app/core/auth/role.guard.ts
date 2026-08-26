import { inject } from "@angular/core";
import { CanMatchFn, Router } from "@angular/router";
import { AuthStore } from "./auth.store";
import { UserService } from "../user.service";
import { UserRole } from "../models/user.model";

/**
 * Guard de rôle. À composer APRÈS authGuard dans canMatch.
 * Charge le profil DB (dont le Role) une seule fois si absent du store.
 */
export const roleGuard = (...allowed: UserRole[]): CanMatchFn => {
  return async () => {
    const authStore = inject(AuthStore);
    const userService = inject(UserService);
    const router = inject(Router);

    if (!authStore.dbUser()) {
      try {
        authStore.setDbUser(await userService.getMe());
      } catch {
        return router.createUrlTree(["/login"]);
      }
    }

    const role = authStore.role();
    if (role && allowed.includes(role)) {
      return true;
    }

    return router.createUrlTree(["/login"]);
  };
};
