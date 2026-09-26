import { EmailProvider } from "./EmailProvider.js";
import { logger } from "../../config/logger.js";

/**
 * Fournisseur de développement: aucun envoi réel, tout passe par winston.
 */
export class DryRunEmailProvider extends EmailProvider {
  async send({ to, subject, text, attachments }) {
    const files = attachments?.length ? ` | pièces jointes: ${attachments.map((a) => `${a.filename} (${a.content?.length ?? 0} octets)`).join(", ")}` : "";
    logger.info(`[DRY-RUN EMAIL] à ${to} | ${subject} | ${text?.slice(0, 200)}${files}`);
    return { providerMessageId: `dry-run-email-${Date.now()}` };
  }
}
