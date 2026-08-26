import crypto from "node:crypto";
import { ConfigService } from "../config/configService.js";

const configService = new ConfigService();

const SMS_MAX_BODY_LENGTH = 450;
const SMS_UNSUBSCRIBE_FOOTER = "\nRépondez ARRET pour vous désabonner.";

/**
 * Interpole {{prenom}}, {{adresse}}, {{reference}} dans un gabarit.
 */
export const interpolate = (template, { firstName, address, reference } = {}) => {
  return String(template || "")
    .replaceAll("{{prenom}}", firstName || "")
    .replaceAll("{{adresse}}", address || "")
    .replaceAll("{{reference}}", reference || "")
    .trim();
};

/**
 * Corps SMS final: tronqué + pied de désabonnement obligatoire (LCAP).
 */
export const buildSmsBody = (body, variables) => {
  const interpolated = interpolate(body, variables);
  const truncated =
    interpolated.length > SMS_MAX_BODY_LENGTH
      ? `${interpolated.slice(0, SMS_MAX_BODY_LENGTH - 1)}…`
      : interpolated;
  return `${truncated}${SMS_UNSUBSCRIBE_FOOTER}`;
};

/**
 * Jeton HMAC de désabonnement courriel — stateless, aucune table nécessaire.
 */
export const buildUnsubscribeToken = (email) => {
  const secret = configService.get("UNSUBSCRIBE_SECRET");
  if (!secret) {
    throw new Error("UNSUBSCRIBE_SECRET n'est pas configuré.");
  }
  return crypto.createHmac("sha256", secret).update(String(email).trim().toLowerCase()).digest("hex");
};

export const verifyUnsubscribeToken = (email, token) => {
  const expected = buildUnsubscribeToken(email);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(token || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const buildUnsubscribeUrl = (email) => {
  const base = configService.get("PUBLIC_BASE_URL");
  const token = buildUnsubscribeToken(email);
  return `${base}/desabonnement?e=${encodeURIComponent(email)}&t=${token}`;
};

/**
 * Enveloppe HTML FR avec pied de désabonnement obligatoire (LCAP).
 */
export const buildEmailHtml = (body, recipientEmail, variables) => {
  const interpolated = interpolate(body, variables).replaceAll("\n", "<br />");
  const unsubscribeUrl = buildUnsubscribeUrl(recipientEmail);
  return `<!doctype html>
<html lang="fr">
<body style="font-family: Arial, sans-serif; color: #2f3840; max-width: 600px; margin: 0 auto; padding: 16px;">
  <div style="border-top: 4px solid #052261; padding-top: 16px;">
    ${interpolated}
  </div>
  <hr style="border: none; border-top: 1px solid #e3e6ea; margin: 24px 0 12px;" />
  <p style="font-size: 12px; color: #7a8591;">
    Vous recevez ce courriel parce que vous êtes associé à un contrat de déneigement.
    <a href="${unsubscribeUrl}" style="color: #052261;">Se désabonner</a>
  </p>
</body>
</html>`;
};

export const buildEmailText = (body, recipientEmail, variables) => {
  const interpolated = interpolate(body, variables);
  return `${interpolated}\n\n---\nSe désabonner: ${buildUnsubscribeUrl(recipientEmail)}`;
};
