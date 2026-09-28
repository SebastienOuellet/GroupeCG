/** Origine de l'ordre de passage en vigueur sur une route. */
export const ROUTE_SEQUENCE_SOURCE = {
  MANUAL: "manual",
  OPTIMIZED: "optimized"
};

export const ROUTE_SEQUENCE_SOURCES = Object.values(ROUTE_SEQUENCE_SOURCE);

/** Plafond de sécurité d'une séquence envoyée en une fois (50 routes × ~100 adresses en pratique). */
export const MAX_ROUTE_SEQUENCE_LENGTH = 1000;
