import { ForbiddenError } from "../errors/Errors.js";

/**
 * Factory de middleware de contrôle de rôle. S'utilise APRÈS
 * requiredUserAuthenticated (injecté par Server.setRoutes quand authRequired).
 *
 * @param {string|string[]} roles - Rôle(s) autorisé(s), voir USER_ROLES.
 * @returns {Function} Middleware Express.
 */
export const requireRole = (roles) => {
  const allowed = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    if (!req.user || !allowed.includes(req.user.Role)) {
      throw new ForbiddenError();
    }
    next();
  };
};
