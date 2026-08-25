import { inject } from "@angular/core";
import { CanMatchFn, Router } from "@angular/router";
import { AuthStore } from "./auth.store";

export const authGuard: CanMatchFn = async () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  await waitForAuthInit(authStore);

  if (authStore.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(["/login"]);
};

export const guestGuard: CanMatchFn = async () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  await waitForAuthInit(authStore);

  if (!authStore.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(["/"]);
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
