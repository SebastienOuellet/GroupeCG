import { computed, inject, Injectable, signal } from "@angular/core";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser
} from "firebase/auth";
import { FirebaseService } from "../firebase.service";
import { User } from "../models/user.model";

/**
 * État d'authentification centralisé (signals). Le token est mis en cache pour
 * l'intercepteur HTTP; Firebase le rafraîchit automatiquement toutes les heures.
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

    onAuthStateChanged(auth, async (firebaseUser) => {
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

  async refreshToken(): Promise<string | null> {
    const user = this.user();
    if (!user) return null;
    const token = await user.getIdToken(true);
    this.token.set(token);
    return token;
  }
}
