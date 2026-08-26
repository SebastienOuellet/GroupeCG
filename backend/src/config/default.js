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

  NOTIFICATIONS_DRY_RUN: process.env.NOTIFICATIONS_DRY_RUN !== "false",
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || "http://localhost:4200",
  UNSUBSCRIBE_SECRET: process.env.UNSUBSCRIBE_SECRET,
  PORTAL_TOKEN_SECRET: process.env.PORTAL_TOKEN_SECRET,
  RENEWAL_REMINDER_DAYS: Number(process.env.RENEWAL_REMINDER_DAYS) || 45,
  TWILIO_VALIDATE_SIGNATURE: process.env.TWILIO_VALIDATE_SIGNATURE !== "false"
};
