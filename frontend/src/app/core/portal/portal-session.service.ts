import { computed, Injectable, signal } from "@angular/core";

const STORAGE_KEY = "portalToken";

/**
 * Session du portail public: un jeton en sessionStorage (pas de compte
 * Firebase). Distinct de AuthStore — mécanisme d'authentification différent.
 */
@Injectable({
  providedIn: "root"
})
export class PortalSessionService {
  private readonly tokenSignal = signal<string | null>(sessionStorage.getItem(STORAGE_KEY));

  readonly token = computed(() => this.tokenSignal());
  readonly isAuthenticated = computed(() => this.tokenSignal() !== null);

  setToken(token: string): void {
    sessionStorage.setItem(STORAGE_KEY, token);
    this.tokenSignal.set(token);
  }

  clear(): void {
    sessionStorage.removeItem(STORAGE_KEY);
    this.tokenSignal.set(null);
  }
}
