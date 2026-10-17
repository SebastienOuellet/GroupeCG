import { inject } from "@angular/core";
import { CanMatchFn, Router } from "@angular/router";
import { AuthStore } from "./auth.store";
import { attemptedUrl, loginRedirect, requestedReturnUrl } from "./auth-redirect";

/** Page d'accueil des visiteurs non connectés : l'espace client, pas la connexion des employés. */
const PUBLIC_HOME_PATH = "/portail";

export const authGuard: CanMatchFn = async () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  await waitForAuthInit(authStore);

  if (authStore.isAuthenticated()) {
    return true;
  }

  // La racine du domaine est l'adresse donnée aux clients : on les envoie à leur espace.
  // Une page interne (/clients, /routes/5…) garde la redirection vers /login avec returnUrl.
  if (isSiteRoot(router)) {
    return router.createUrlTree([PUBLIC_HOME_PATH]);
  }

  return loginRedirect(router);
};

const isSiteRoot = (router: Router): boolean => router.parseUrl(attemptedUrl(router)).root.children["primary"] === undefined;

export const guestGuard: CanMatchFn = async () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  await waitForAuthInit(authStore);

  if (!authStore.isAuthenticated()) {
    return true;
  }

  // Déjà connecté (ex. session restaurée pendant la redirection) : retour à la page demandée.
  return router.parseUrl(requestedReturnUrl(router) ?? "/");
};

const waitForAuthInit = (authStore: AuthStore): Promise<void> => {
  if (authStore.isInitialized()) return Promise.resolve();

  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (authStore.isInitialized()) {
        clearInterval(interval);
        resolve();
      }
    }, 25);
  });
};
