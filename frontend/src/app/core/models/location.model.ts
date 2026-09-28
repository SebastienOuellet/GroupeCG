/** Emplacement nommé : dépôt des routes ou point d'attache d'une route. */
export interface NamedLocation {
  label: string;
  /** Identifiant Google : seule donnée Google stockable indéfiniment. */
  placeId: string | null;
  latitude: number;
  longitude: number;
  /** Date des coordonnées (cache Google rafraîchi après GOOGLE_LOCATION_MAX_AGE_DAYS). */
  locationUpdatedAt?: string | null;
}

/** Provenance des coordonnées d'une adresse de service. */
export type LocationSource = "google_places" | "manual_pin";

/**
 * Durée de conservation des coordonnées issues de Google Places (conditions Google :
 * cache temporaire, seul le place_id est permanent). Au-delà, on les redemande par PlaceId.
 */
export const GOOGLE_LOCATION_MAX_AGE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Vrai si des coordonnées Google doivent être redemandées (un pin manuel n'expire jamais). */
export function isGoogleLocationStale(source: LocationSource | null | undefined, updatedAt: string | null | undefined, now = Date.now()): boolean {
  if (source !== "google_places") return false;
  if (!updatedAt) return true;
  return now - new Date(updatedAt).getTime() > GOOGLE_LOCATION_MAX_AGE_DAYS * DAY_MS;
}

/** Distance à vol d'oiseau (km), formule de Haversine. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
