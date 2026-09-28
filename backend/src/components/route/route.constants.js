import { CONTRACT_STATUS } from "../contract/contract.constants.js";
import { DRIVEWAY_SURFACE } from "../serviceAddress/serviceAddress.constants.js";

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

/**
 * Durée de déneigement estimée par entrée (secondes), selon le revêtement.
 * Valeurs de départ ; réglables par l'admin en phase R3.
 */
export const DEFAULT_VISIT_SECONDS_BY_SURFACE = {
  [DRIVEWAY_SURFACE.ASPHALT]: 240,
  [DRIVEWAY_SURFACE.CONCRETE]: 240,
  [DRIVEWAY_SURFACE.PAVERS]: 300,
  [DRIVEWAY_SURFACE.GRAVEL]: 300,
  [DRIVEWAY_SURFACE.OTHER]: 300
};
export const DEFAULT_VISIT_SECONDS = 240;
