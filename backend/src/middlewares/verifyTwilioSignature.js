import twilio from "twilio";
import { ConfigService } from "../config/configService.js";
import { logger } from "../config/logger.js";

const configService = new ConfigService();

/**
 * Valide la signature X-Twilio-Signature sur les webhooks publics.
 * Désactivable en dev via TWILIO_VALIDATE_SIGNATURE=false (tests locaux
 * par POST simulé). En production, toujours actif.
 */
export const verifyTwilioSignature = (req, res, next) => {
  if (!configService.get("TWILIO_VALIDATE_SIGNATURE")) {
    return next();
  }

  const authToken = configService.get("TWILIO_AUTH_TOKEN");
  if (!authToken) {
    logger.error("Webhook Twilio reçu mais TWILIO_AUTH_TOKEN absent de la config.");
    return res.status(503).end();
  }

  const signature = req.headers["x-twilio-signature"];
  const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  const valid = twilio.validateRequest(authToken, signature, url, req.body || {});

  if (!valid) {
    logger.warn(`Signature Twilio invalide pour ${url}`);
    return res.status(403).end();
  }

  next();
};
