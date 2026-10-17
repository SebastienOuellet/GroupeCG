import firebaseAppAdmin from "firebase-admin";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { logger } from "./logger.js";
import { ConfigService } from "./configService.js";
import { InternalServerError } from "../errors/Errors.js";
import { loadServiceAccount } from "./serviceAccount.js";

const configService = new ConfigService();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let app;

/**
 * Initialise (une seule fois) l'app Firebase Admin à partir du service account :
 * FIREBASE_SERVICE_ACCOUNT_JSON (prod) ou FIREBASE_CREDENTIAL_FILE dans backend/firebaseConfig/ (dev).
 * Volontairement paresseux: le serveur doit pouvoir démarrer (ex. /api/health)
 * même avant qu'un projet Firebase soit configuré.
 */
const getFirebaseApp = () => {
  if (app) return app;

  if (firebaseAppAdmin.apps.length) {
    app = firebaseAppAdmin.app();
    return app;
  }

  let serviceAccount;
  try {
    serviceAccount = loadServiceAccount({
      json: configService.get("FIREBASE_SERVICE_ACCOUNT_JSON"),
      jsonVar: "FIREBASE_SERVICE_ACCOUNT_JSON",
      dir: join(__dirname, "../../firebaseConfig/"),
      file: configService.get("FIREBASE_CREDENTIAL_FILE"),
      fileVar: "FIREBASE_CREDENTIAL_FILE"
    });
  } catch (error) {
    // 500 et non 401 : c'est la config du serveur qui manque, pas le token de l'utilisateur.
    logger.error(`Firebase Admin : ${error.message}`);
    throw new InternalServerError("Authentification indisponible : Firebase n'est pas configuré sur le serveur.");
  }

  app = firebaseAppAdmin.initializeApp({
    credential: firebaseAppAdmin.credential.cert(serviceAccount)
  });
  return app;
};

/**
 * Vérifie un ID token Firebase envoyé par le client.
 * @param {string} token
 * @returns {Promise<import("firebase-admin/auth").DecodedIdToken>}
 */
export const verifyIdToken = async (token) => {
  return getFirebaseAuth()
    .verifyIdToken(token)
    .catch((error) => {
      logger.error(`Firebase token verification failed: ${error.message}`);
      throw error;
    });
};

export const getFirebaseAuth = () => getFirebaseApp().auth();
