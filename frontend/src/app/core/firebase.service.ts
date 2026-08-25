import { Injectable } from "@angular/core";
import { FirebaseApp, initializeApp } from "firebase/app";
import { Auth, getAuth } from "firebase/auth";
import { environment } from "../../environments/environment";

/**
 * Initialise Firebase Admin de façon défensive: tant que `environment.firebase`
 * n'est pas rempli (voir src/environments), `auth` reste `null` et `initError`
 * porte un message explicite plutôt que de faire planter le bootstrap de l'app.
 */
@Injectable({
  providedIn: "root"
})
export class FirebaseService {
  app: FirebaseApp | null = null;
  auth: Auth | null = null;
  initError: string | null = null;

  constructor() {
    if (!environment.firebase.apiKey) {
      this.initError =
        "Firebase n'est pas configuré: renseigne `firebase` dans src/environments/environment.*.ts.";
      return;
    }

    try {
      this.app = initializeApp(environment.firebase);
      this.auth = getAuth(this.app);
    } catch (error) {
      this.initError = `Échec de l'initialisation Firebase: ${(error as Error).message}`;
    }
  }
}
