import { BadRequestError } from "../errors/Errors.js";

const MAX_LABEL_LENGTH = 255;
const MAX_PLACE_ID_LENGTH = 255;

/**
 * Valide un emplacement nommé (dépôt, point d'attache d'une route) :
 * `{ label, placeId?, latitude, longitude }`. Retourne une copie normalisée
 * avec `locationUpdatedAt` (les coordonnées Google sont un cache daté).
 */
export const normalizeNamedLocation = (input, fieldLabel) => {
  if (!input || typeof input !== "object") {
    throw new BadRequestError(`${fieldLabel} : emplacement manquant.`);
  }
  const label = String(input.label ?? "").trim();
  if (!label || label.length > MAX_LABEL_LENGTH) {
    throw new BadRequestError(`${fieldLabel} : libellé requis (${MAX_LABEL_LENGTH} caractères max).`);
  }
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  if (input.latitude == null || input.longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new BadRequestError(`${fieldLabel} : coordonnées invalides.`);
  }
  const placeId = input.placeId ? String(input.placeId).trim() : null;
  if (placeId && placeId.length > MAX_PLACE_ID_LENGTH) {
    throw new BadRequestError(`${fieldLabel} : identifiant de lieu invalide.`);
  }
  return { label, placeId, latitude, longitude, locationUpdatedAt: new Date().toISOString() };
};
