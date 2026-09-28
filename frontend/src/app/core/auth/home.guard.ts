import { inject } from "@angular/core";
import { CanMatchFn, Router } from "@angular/router";
import { AuthStore } from "./auth.store";
import { UserService } from "../user.service";
import { ensureDbUser, loginRedirect, PENDING_ACCESS_PATH, pendingAccessRedirect } from "./auth-redirect";

/**
 * Garde du "/" racine: redirige selon le rôle plutôt que vers /login,
 * pour éviter une boucle infinie avec guestGuard (qui renvoie tout
 * utilisateur authentifié vers "/"). Seul l'admin passe ce guard;
 * les autres rôles sont redirigés vers leur propre espace.
 */
export const homeGuard: CanMatchFn = async () => {
  const authStore = inject(AuthStore);
  const userService = inject(UserService);
  const router = inject(Router);

  if (!(await ensureDbUser(authStore, userService))) {
    // Profil injoignable : ne pas passer par /login (guestGuard renverrait vers "/"
    // et on perdrait la page demandée), mais vers une page qui permet de réessayer.
    return authStore.isAuthenticated() ? pendingAccessRedirect(router) : loginRedirect(router);
  }

  const role = authStore.role();
  if (role === "admin") return true;
  if (role === "operator") return router.createUrlTree(["/operateur"]);

  // Authentifié mais sans rôle : ne PAS renvoyer vers /login (guestGuard
  // renverrait vers "/" → boucle infinie).
  return router.createUrlTree([PENDING_ACCESS_PATH]);
};
