import firebaseAppAdmin from "firebase-admin";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { logger } from "./logger.js";
import { ConfigService } from "./configService.js";
import { InternalServerError } from "../errors/Errors.js";

const configService = new ConfigService();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let app;

/**
 * Initialise (une seule fois) l'app Firebase Admin à partir du service account
 * référencé par FIREBASE_CREDENTIAL_FILE dans backend/firebaseConfig/.
 * Volontairement paresseux: le serveur doit pouvoir démarrer (ex. /api/health)
 * même avant qu'un projet Firebase soit configuré.
 */
const getFirebaseApp = () => {
  if (app) return app;

  if (firebaseAppAdmin.apps.length) {
    app = firebaseAppAdmin.app();
    return app;
  }

  const credentialFile = configService.get("FIREBASE_CREDENTIAL_FILE");
  if (!credentialFile) {
    throw new InternalServerError(
      "FIREBASE_CREDENTIAL_FILE n'est pas défini dans le .env. Ajoutez le fichier de service account Firebase dans backend/firebaseConfig/ et référencez son nom dans le .env."
    );
  }

  const serviceAccountPath = join(__dirname, "../../firebaseConfig/", credentialFile);
  if (!existsSync(serviceAccountPath)) {
    throw new InternalServerError(
      `Fichier de credentials Firebase introuvable: ${serviceAccountPath}. Déposez le JSON du service account dans backend/firebaseConfig/.`
    );
  }

  app = firebaseAppAdmin.initializeApp({
    credential: firebaseAppAdmin.credential.cert(serviceAccountPath)
  });
  return app;
};

/**
 * Vérifie un ID token Firebase envoyé par le client.
 * @param {string} token
 * @returns {Promise<import("firebase-admin/auth").DecodedIdToken>}
 */
export const verifyIdToken = async (token) => {
  return getFirebaseApp()
    .auth()
    .verifyIdToken(token)
    .catch((error) => {
      logger.error(`Firebase token verification failed: ${error.message}`);
      throw error;
    });
};

export const getFirebaseAuth = () => getFirebaseApp().auth();
