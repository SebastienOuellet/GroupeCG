import { verifyPortalToken } from "./portal.token.js";
import { UnauthorizedError } from "../../errors/Errors.js";

/**
 * Authentifie une requête du portail public via le header X-Portal-Token
 * (pas de Firebase ici — les clients n'ont pas de compte). Attache
 * `req.portalContractId`.
 */
export const portalAuth = (req, res, next) => {
  const token = req.headers["x-portal-token"];
  if (!token) {
    throw new UnauthorizedError("Session requise.");
  }
  const { contractId } = verifyPortalToken(token);
  req.portalContractId = contractId;
  next();
};
