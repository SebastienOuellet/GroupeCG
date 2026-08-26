import { EmailProvider } from "./EmailProvider.js";
import { logger } from "../../config/logger.js";

/**
 * Fournisseur de développement: aucun envoi réel, tout passe par winston.
 */
export class DryRunEmailProvider extends EmailProvider {
  async send({ to, subject, text }) {
    logger.info(`[DRY-RUN EMAIL] à ${to} | ${subject} | ${text?.slice(0, 200)}`);
    return { providerMessageId: `dry-run-email-${Date.now()}` };
  }
}
