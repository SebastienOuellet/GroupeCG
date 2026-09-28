import { Router, UrlTree } from "@angular/router";
import { AuthStore } from "./auth.store";
import { UserService } from "../user.service";

/**
 * Conserver la page demandée à travers les redirections d'authentification.
 *
 * Sans ça, un rafraîchissement sur /routes/5 dont un guard échoue (profil DB
 * injoignable un instant, session Firebase pas encore restaurée) passait par
 * /login → guestGuard → "/" → /clients : l'utilisateur perdait sa page.
 */
export const RETURN_URL_PARAM = "returnUrl";

/** Page d'un compte authentifié sans rôle, ou dont le profil n'a pas pu être chargé. */
export const PENDING_ACCESS_PATH = "/acces-en-attente";

const LOGIN_PATH = "/login";
const DB_USER_RETRY_DELAY_MS = 800;

/** URL visée par la navigation en cours (dans un guard), sinon l'URL affichée. */
export const attemptedUrl = (router: Router): string => {
  const navigation = router.currentNavigation();
  return navigation ? router.serializeUrl(navigation.extractedUrl) : router.url;
};

/** N'accepte qu'un chemin interne (pas de redirection ouverte vers un autre site). */
export const safeReturnUrl = (url: string | null | undefined): string | null => {
  if (!url || !url.startsWith("/") || url.startsWith("//") || url.startsWith("/\\")) return null;
  if (url === "/" || url.startsWith(LOGIN_PATH) || url.startsWith(PENDING_ACCESS_PATH)) return null;
  return url;
};

/** Paramètre `returnUrl` de la navigation en cours ou de l'URL affichée. */
export const requestedReturnUrl = (router: Router): string | null => {
  const tree = router.parseUrl(attemptedUrl(router));
  return safeReturnUrl(tree.queryParamMap.get(RETURN_URL_PARAM));
};

const withReturnUrl = (router: Router, path: string, returnUrl: string | null): UrlTree => {
  const target = safeReturnUrl(returnUrl);
  return router.createUrlTree([path], target ? { queryParams: { [RETURN_URL_PARAM]: target } } : {});
};

/** /login en gardant la page demandée. */
export const loginRedirect = (router: Router, returnUrl: string | null = attemptedUrl(router)): UrlTree =>
  withReturnUrl(router, LOGIN_PATH, returnUrl);

/** Page d'attente (profil injoignable ou sans rôle) en gardant la page demandée. */
export const pendingAccessRedirect = (router: Router): UrlTree =>
  withReturnUrl(router, PENDING_ACCESS_PATH, attemptedUrl(router));

/**
 * Charge le profil DB (dont le Role) s'il est absent. Un échec réseau ou un
 * backend qui redémarre (nodemon) ne doit pas déconnecter : on réessaie une fois.
 * Retourne `false` si le profil reste introuvable.
 */
export const ensureDbUser = async (authStore: AuthStore, userService: UserService): Promise<boolean> => {
  if (authStore.dbUser()) return true;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      authStore.setDbUser(await userService.getMe());
      return true;
    } catch {
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, DB_USER_RETRY_DELAY_MS));
    }
  }
  return false;
};
