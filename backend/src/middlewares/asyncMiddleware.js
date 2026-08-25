import { InternalServerError } from "../errors/Errors.js";
import { logger } from "../config/logger.js";

/**
 * Enveloppe un handler async pour transmettre automatiquement ses erreurs à `next()`,
 * évitant un try/catch répété dans chaque controller.
 * @param {Function} fn
 * @returns {Function}
 */
export const asyncMiddleware = (fn) => (req, res, next) => {
  if (typeof fn !== "function") {
    logger.error("asyncMiddleware: le middleware fourni n'est pas une fonction.");
    return next(new InternalServerError("Le middleware n'est pas une fonction."));
  }

  Promise.resolve(fn(req, res, next)).catch((error) => {
    logger.error(`Erreur lors de l'exécution du middleware: ${error.message}`);
    next(error);
  });
};
