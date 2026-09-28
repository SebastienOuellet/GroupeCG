import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// src/config -> backend/.env
const envPath = path.resolve(__dirname, "../../.env");
config({ path: envPath });

export const defaultConfig = {
  NODE_ENV: process.env.NODE_ENV || "development",
  NODE_URL: process.env.NODE_URL,
  PORT: Number(process.env.PORT) || 5010,

  DB_USER: process.env.DB_USER,
  DB_PW: process.env.DB_PW,
  DB_HOST: process.env.DB_HOST,
  DB_NAME: process.env.DB_NAME,
  DB_PORT: Number(process.env.DB_PORT) || 5432,

  FIREBASE_CREDENTIAL_FILE: process.env.FIREBASE_CREDENTIAL_FILE,

  LOG_LEVEL: process.env.LOG_LEVEL || "debug",
  LOG_FORMAT: process.env.LOG_FORMAT || "combined",

  NO_REPLY_EMAIL: process.env.NO_REPLY_EMAIL,
  SMTPGO_SERVER: process.env.SMTPGO_SERVER,
  SMTPGO_PORT: Number(process.env.SMTPGO_PORT) || 2525,
  SMTPGO_USER: process.env.SMTPGO_USER,
  SMTPGO_PW: process.env.SMTPGO_PW,

  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_MESSAGING_SERVICE_SID: process.env.TWILIO_MESSAGING_SERVICE_SID,

  /** Notifications aux résidents (SMS + courriels de tempête/route/renouvellement). */
  NOTIFICATIONS_DRY_RUN: process.env.NOTIFICATIONS_DRY_RUN !== "false",
  /**
   * Courriels de contrat, indépendants de NOTIFICATIONS_DRY_RUN : envoi réel dès que
   * SMTP est configuré. Mettre à "true" pour tester sans rien envoyer (journalisation seulement).
   */
  CONTRACT_EMAIL_DRY_RUN: process.env.CONTRACT_EMAIL_DRY_RUN === "true",
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || "http://localhost:4200",
  UNSUBSCRIBE_SECRET: process.env.UNSUBSCRIBE_SECRET,
  PORTAL_TOKEN_SECRET: process.env.PORTAL_TOKEN_SECRET,
  RENEWAL_REMINDER_DAYS: Number(process.env.RENEWAL_REMINDER_DAYS) || 45,
  TWILIO_VALIDATE_SIGNATURE: process.env.TWILIO_VALIDATE_SIGNATURE !== "false",

  /* Optimisation des routes (src/routing/). Dry-run par défaut : optimiseur local, aucun appel Google. */
  ROUTE_OPTIMIZATION_DRY_RUN: process.env.ROUTE_OPTIMIZATION_DRY_RUN !== "false",
  /** true = Google valide la requête sans la résoudre ni la facturer (test de configuration). */
  ROUTE_OPTIMIZATION_VALIDATE_ONLY: process.env.ROUTE_OPTIMIZATION_VALIDATE_ONLY === "true",
  ROUTE_OPTIMIZATION_TIMEOUT_SECONDS: Number(process.env.ROUTE_OPTIMIZATION_TIMEOUT_SECONDS) || 30,
  GOOGLE_CLOUD_PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT_ID,
  /** Fichier JSON du compte de service dans backend/googleConfig/ (non versionné). */
  GOOGLE_ROUTE_OPTIMIZATION_CREDENTIAL_FILE: process.env.GOOGLE_ROUTE_OPTIMIZATION_CREDENTIAL_FILE,

  /* En-tête du contrat PDF. Les numéros TPS/TVQ sont obligatoires sur une facture au Québec. */
  COMPANY_NAME: process.env.COMPANY_NAME || "Groupe CG",
  /** Raison sociale utilisée dans les clauses (ex. « Entreprises Christian Giroux ») ; défaut : COMPANY_NAME. */
  COMPANY_LEGAL_NAME: process.env.COMPANY_LEGAL_NAME || process.env.COMPANY_NAME || "Groupe CG",
  /** Signataire pour l'entreprise (ex. « M. Christian Giroux »), facultatif. */
  COMPANY_REPRESENTATIVE: process.env.COMPANY_REPRESENTATIVE || "",
  /** Ville où l'entente intervient (« Entente intervenue à Sherbrooke »), facultatif. */
  COMPANY_CITY: process.env.COMPANY_CITY || "",
  COMPANY_ADDRESS: process.env.COMPANY_ADDRESS || "",
  COMPANY_PHONE: process.env.COMPANY_PHONE || "",
  COMPANY_EMAIL: process.env.COMPANY_EMAIL || "",
  COMPANY_TPS_NUMBER: process.env.COMPANY_TPS_NUMBER || "",
  COMPANY_TVQ_NUMBER: process.env.COMPANY_TVQ_NUMBER || "",
  /** Chemin du logo PNG/JPG ; défaut : le logo du frontend (frontend/public/images/logo.png). */
  COMPANY_LOGO_PATH: process.env.COMPANY_LOGO_PATH || path.resolve(__dirname, "../../../frontend/public/images/logo.png")
};
