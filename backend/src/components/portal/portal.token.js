import crypto from "node:crypto";
import { ConfigService } from "../../config/configService.js";
import { InternalServerError, UnauthorizedError } from "../../errors/Errors.js";

const configService = new ConfigService();
const TOKEN_TTL_MS = 30 * 60 * 1000;

const getSecret = () => {
  const secret = configService.get("PORTAL_TOKEN_SECRET");
  if (!secret) {
    throw new InternalServerError("PORTAL_TOKEN_SECRET n'est pas configuré.");
  }
  return secret;
};

const sign = (payload) => crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");

/**
 * Jeton de session du portail: stateless, `{contractId, exp}` signé HMAC.
 * Format `<payload base64url>.<signature hex>` — aucune table de session.
 */
export const signPortalToken = (contractId) => {
  const payload = Buffer.from(JSON.stringify({ contractId, exp: Date.now() + TOKEN_TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
};

export const verifyPortalToken = (token) => {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) {
    throw new UnauthorizedError("Session expirée. Veuillez vous reconnecter.");
  }

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new UnauthorizedError("Session expirée. Veuillez vous reconnecter.");
  }

  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!data.exp || data.exp < Date.now()) {
    throw new UnauthorizedError("Session expirée. Veuillez vous reconnecter.");
  }

  return { contractId: data.contractId };
};
