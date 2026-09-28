import { inject } from "@angular/core";
import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
  HttpStatusCode
} from "@angular/common/http";
import { Router } from "@angular/router";
import { catchError, from, switchMap, throwError } from "rxjs";
import { AuthStore } from "./auth.store";
import { loginRedirect } from "./auth-redirect";

/**
 * Ajoute le Bearer token Firebase à chaque requête, en le rafraîchissant au besoin.
 *
 * 1. Avant l'envoi : `getIdToken()` renvoie un token valide (rafraîchi par Firebase
 *    s'il expire bientôt), jamais une copie périmée.
 * 2. Si le backend répond 401 malgré tout (horloge décalée, veille prolongée) :
 *    on force un nouveau token et on rejoue la requête UNE fois.
 * 3. Si le 401 persiste, la session n'est plus valide (compte désactivé, mot de
 *    passe changé) : déconnexion et retour à /login plutôt qu'un message d'erreur.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  return sendWithToken(req, next, authStore, false).pipe(
    catchError((error: unknown) => {
      if (!isUnauthorized(error) || !authStore.isAuthenticated()) {
        return throwError(() => error);
      }

      return sendWithToken(req, next, authStore, true).pipe(
        catchError((retryError: unknown) => {
          if (isUnauthorized(retryError)) {
            void authStore.logout().then(() => router.navigateByUrl(loginRedirect(router, router.url)));
          }
          return throwError(() => retryError);
        })
      );
    })
  );
};

const sendWithToken = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authStore: AuthStore,
  forceRefresh: boolean
) =>
  from(authStore.getIdToken(forceRefresh)).pipe(
    switchMap((token) =>
      next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req)
    )
  );

const isUnauthorized = (error: unknown): boolean =>
  error instanceof HttpErrorResponse && error.status === HttpStatusCode.Unauthorized;
