import { computed, inject, Injectable, signal } from "@angular/core";
import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser
} from "firebase/auth";
import { FirebaseService } from "../firebase.service";
import { User } from "../models/user.model";

/**
 * État d'authentification centralisé (signals).
 *
 * Le token Firebase expire après 1 h. L'intercepteur HTTP ne lit donc pas un
 * token mis en cache : il appelle `getIdToken()` avant chaque requête. Firebase
 * renvoie alors son token en cache s'il est encore valide (aucun appel réseau),
 * ou en obtient un nouveau s'il expire dans moins de 5 min. Ça couvre aussi le
 * portable sorti de veille, où le minuteur de rafraîchissement du SDK n'a pas
 * tourné. `onIdTokenChanged` (et non `onAuthStateChanged`) garde le signal
 * `token` à jour à chaque rafraîchissement.
 * `dbUser` porte le profil applicatif (dont le Role) chargé depuis l'API.
 */
@Injectable({
  providedIn: "root"
})
export class AuthStore {
  private readonly firebaseService = inject(FirebaseService);

  private readonly user = signal<FirebaseUser | null>(null);
  private readonly token = signal<string | null>(null);
  private readonly initialized = signal(false);
  private readonly appUser = signal<User | null>(null);

  readonly currentUser = computed(() => this.user());
  readonly userToken = computed(() => this.token());
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isInitialized = computed(() => this.initialized());
  readonly configError = computed(() => this.firebaseService.initError);
  readonly dbUser = computed(() => this.appUser());
  readonly role = computed(() => this.appUser()?.Role ?? null);

  constructor() {
    const auth = this.firebaseService.auth;
    if (!auth) {
      // Firebase non configuré: on considère l'utilisateur non authentifié
      // pour laisser l'app démarrer (voir login.html pour le message d'erreur).
      this.initialized.set(true);
      return;
    }

    onIdTokenChanged(auth, async (firebaseUser) => {
      this.user.set(firebaseUser);
      this.token.set(firebaseUser ? await firebaseUser.getIdToken() : null);
      if (!firebaseUser) {
        this.appUser.set(null);
      }
      this.initialized.set(true);
    });
  }

  setDbUser(user: User | null): void {
    this.appUser.set(user);
  }

  async login(email: string, password: string): Promise<void> {
    if (!this.firebaseService.auth) {
      throw new Error(this.firebaseService.initError ?? "Firebase non configuré.");
    }
    const credential = await signInWithEmailAndPassword(this.firebaseService.auth, email, password);
    this.token.set(await credential.user.getIdToken());
  }

  async logout(): Promise<void> {
    if (!this.firebaseService.auth) return;
    await signOut(this.firebaseService.auth);
  }

  /**
   * Token valide pour un appel API, ou `null` si personne n'est connecté.
   * `forceRefresh` : ignore le cache (utilisé après un 401 du backend).
   * Si Firebase est injoignable (hors ligne), on renvoie le dernier token connu :
   * la requête échouera alors avec sa vraie erreur réseau plutôt qu'un faux 401.
   */
  async getIdToken(forceRefresh = false): Promise<string | null> {
    const user = this.firebaseService.auth?.currentUser ?? this.user();
    if (!user) return null;
    try {
      const token = await user.getIdToken(forceRefresh);
      this.token.set(token);
      return token;
    } catch {
      return this.token();
    }
  }
}
