import { ConfigService } from "../config/configService.js";
import { TwilioSmsProvider } from "./providers/TwilioSmsProvider.js";
import { NodemailerEmailProvider } from "./providers/NodemailerEmailProvider.js";
import { DryRunSmsProvider } from "./providers/DryRunSmsProvider.js";
import { DryRunEmailProvider } from "./providers/DryRunEmailProvider.js";

const configService = new ConfigService();

let smsProvider = null;
let emailProvider = null;
let transactionalEmailProvider = null;

/**
 * POINT DE SWAP: pour changer de fournisseur SMS (ex. quitter Twilio),
 * écrire une classe qui étend SmsProvider et la retourner ici.
 */
export const getSmsProvider = () => {
  if (!smsProvider) {
    smsProvider = configService.get("NOTIFICATIONS_DRY_RUN")
      ? new DryRunSmsProvider()
      : new TwilioSmsProvider();
  }
  return smsProvider;
};

export const getEmailProvider = () => {
  if (!emailProvider) {
    emailProvider = configService.get("NOTIFICATIONS_DRY_RUN")
      ? new DryRunEmailProvider()
      : new NodemailerEmailProvider();
  }
  return emailProvider;
};

/**
 * Courriels transactionnels destinés au personnel (création de compte, mot de passe).
 * Volontairement indépendant de NOTIFICATIONS_DRY_RUN, qui protège les résidents :
 * envoi réel dès que SMTP est configuré, sinon repli sur le dry-run (log seulement).
 */
export const getTransactionalEmailProvider = () => {
  if (!transactionalEmailProvider) {
    const smtpConfigured = ["SMTPGO_SERVER", "SMTPGO_USER", "SMTPGO_PW", "NO_REPLY_EMAIL"].every((key) =>
      Boolean(configService.get(key))
    );
    transactionalEmailProvider = smtpConfigured ? new NodemailerEmailProvider() : new DryRunEmailProvider();
  }
  return transactionalEmailProvider;
};

/** Vrai si le fournisseur transactionnel envoie réellement (pas un dry-run). */
export const isTransactionalEmailLive = () => !(getTransactionalEmailProvider() instanceof DryRunEmailProvider);

/** Réinitialise les instances (tests / changement de config à chaud). */
export const resetProviders = () => {
  smsProvider = null;
  emailProvider = null;
  transactionalEmailProvider = null;
};
