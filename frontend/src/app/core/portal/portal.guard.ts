import { inject } from "@angular/core";
import { CanMatchFn, Router } from "@angular/router";
import { PortalSessionService } from "./portal-session.service";

export const portalGuard: CanMatchFn = () => {
  const session = inject(PortalSessionService);
  const router = inject(Router);
  return session.isAuthenticated() || router.createUrlTree(["/portail"]);
};
