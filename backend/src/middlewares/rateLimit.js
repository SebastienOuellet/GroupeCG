import rateLimit from "express-rate-limit";

/** Limite stricte pour le login du portail public (anti force brute). */
export const portalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Trop de tentatives. Réessayez dans 15 minutes.", status: 429 } }
});

/** Suivi du tracteur dans le portail : la page s'actualise toutes les 30 s (30 requêtes / 15 min). */
export const portalTrackingRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Trop de requêtes. Réessayez dans quelques minutes.", status: 429 } }
});

/** Limite générale pour les autres routes publiques. */
export const publicRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Trop de requêtes. Réessayez plus tard.", status: 429 } }
});
