import { verifyIdToken } from "../config/firebase.js";
import { logger } from "../config/logger.js";
import { UnauthorizedError } from "../errors/Errors.js";
import * as userService from "../components/user/user.service.js";

/**
 * Vérifie le Bearer token Firebase et attache l'utilisateur (DB) à `req.user`.
 * À utiliser via `authRequired: true` sur une route (voir Routes.js/Server.js).
 */
export async function requiredUserAuthenticated(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Token d'authentification manquant.");
  }

  const token = authHeader.split(" ")[1];

  let decodedToken;
  try {
    decodedToken = await verifyIdToken(token);
  } catch (error) {
    logger.error(`Auth error: ${error.message}`);
    throw new UnauthorizedError("Token d'authentification invalide ou expiré.");
  }

  const user = await userService.findOrCreateFromFirebase(decodedToken);

  req.user = user;
  next();
}
