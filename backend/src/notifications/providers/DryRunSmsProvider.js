import { SmsProvider } from "./SmsProvider.js";
import { logger } from "../../config/logger.js";

/**
 * Fournisseur de développement: aucun envoi réel, tout passe par winston.
 * Activé par NOTIFICATIONS_DRY_RUN=true (défaut hors production).
 */
export class DryRunSmsProvider extends SmsProvider {
  async send({ to, body }) {
    logger.info(`[DRY-RUN SMS] à ${to} | ${body}`);
    return { providerMessageId: `dry-run-sms-${Date.now()}` };
  }
}
