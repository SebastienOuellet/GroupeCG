import { ConfigService } from "../config/configService.js";
import { TwilioSmsProvider } from "./providers/TwilioSmsProvider.js";
import { NodemailerEmailProvider } from "./providers/NodemailerEmailProvider.js";
import { DryRunSmsProvider } from "./providers/DryRunSmsProvider.js";
import { DryRunEmailProvider } from "./providers/DryRunEmailProvider.js";

const configService = new ConfigService();

let smsProvider = null;
let emailProvider = null;

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

/** Réinitialise les instances (tests / changement de config à chaud). */
export const resetProviders = () => {
  smsProvider = null;
  emailProvider = null;
};
