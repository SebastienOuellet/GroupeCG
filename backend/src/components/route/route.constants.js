import { CONTRACT_STATUS } from "../contract/contract.constants.js";
import { DRIVEWAY_SIZE, DRIVEWAY_SURFACE } from "../serviceAddress/serviceAddress.constants.js";

/** Origine de l'ordre de passage en vigueur sur une route. */
export const ROUTE_SEQUENCE_SOURCE = {
  MANUAL: "manual",
  OPTIMIZED: "optimized"
};

export const ROUTE_SEQUENCE_SOURCES = Object.values(ROUTE_SEQUENCE_SOURCE);

/** Plafond de sécurité d'une séquence envoyée en une fois (50 routes × ~100 adresses en pratique). */
export const MAX_ROUTE_SEQUENCE_LENGTH = 1000;

/** Contrats qu'on ordonne sur une route : ceux de la tournée (actifs) et à venir (brouillons, ex. après le roulement). */
export const ROUTE_ORDERABLE_CONTRACT_STATUSES = [CONTRACT_STATUS.ACTIVE, CONTRACT_STATUS.DRAFT];

/** Revêtement non précisé : clé des durées. */
export const UNKNOWN_SURFACE = "unknown";

/**
 * Valeurs par défaut des paramètres de l'optimiseur (Settings `route_optimization`), réglables
 * dans Paramètres › Routes. Une valeur ajoutée ici plus tard prend son défaut automatiquement.
 *  - visitMinutesBySurface : minutes de déneigement d'une entrée simple, par revêtement
 *  - sizeFactors           : multiplicateur selon la taille de l'entrée (non précisée = simple)
 *  - departureTime         : heure de départ habituelle d'une tournée (HH:MM, heure de l'Est)
 */
export const DEFAULT_ROUTE_OPTIMIZATION_SETTINGS = {
  visitMinutesBySurface: {
    [DRIVEWAY_SURFACE.ASPHALT]: 4,
    [DRIVEWAY_SURFACE.CONCRETE]: 4,
    [DRIVEWAY_SURFACE.PAVERS]: 5,
    [DRIVEWAY_SURFACE.GRAVEL]: 5,
    [DRIVEWAY_SURFACE.OTHER]: 5,
    [UNKNOWN_SURFACE]: 4
  },
  sizeFactors: {
    [DRIVEWAY_SIZE.SINGLE]: 1,
    [DRIVEWAY_SIZE.DOUBLE]: 1.5,
    [DRIVEWAY_SIZE.TRIPLE]: 2,
    [DRIVEWAY_SIZE.LARGE]: 3
  },
  departureTime: "03:30"
};

export const ROUTE_OPTIMIZATION_LIMITS = {
  visitMinutes: { min: 0.5, max: 120 },
  sizeFactor: { min: 0.5, max: 10 }
};
