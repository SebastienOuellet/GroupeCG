import { inject } from "@angular/core";
import { CanMatchFn, Router } from "@angular/router";
import { PortalSessionService } from "./portal-session.service";
import { environment } from "../../../environments/environment";

export const portalGuard: CanMatchFn = () => {
  const session = inject(PortalSessionService);
  const router = inject(Router);
  // Avis actif : l'espace client est fermé, même avec une ancienne session.
  if (environment.clientNotice.enabled) return router.createUrlTree(["/portail"]);
  return session.isAuthenticated() || router.createUrlTree(["/portail"]);
};
