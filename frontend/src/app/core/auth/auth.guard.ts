import { inject } from "@angular/core";
import { CanMatchFn, Router } from "@angular/router";
import { AuthStore } from "./auth.store";
import { loginRedirect, requestedReturnUrl } from "./auth-redirect";

export const authGuard: CanMatchFn = async () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  await waitForAuthInit(authStore);

  if (authStore.isAuthenticated()) {
    return true;
  }

  return loginRedirect(router);
};

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
