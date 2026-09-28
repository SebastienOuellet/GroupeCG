const EARTH_RADIUS_KM = 6371;
const rad = (degrees) => (degrees * Math.PI) / 180;

/** Distance à vol d'oiseau (km) entre deux points { latitude, longitude }. */
export const haversineKm = (a, b) => {
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
};

export const hasCoordinates = (point) =>
  point != null && Number.isFinite(point.latitude) && Number.isFinite(point.longitude);

/** Longueur à vol d'oiseau départ → arrêts → retour (points sans coordonnées ignorés). */
export const pathKm = (start, stops, end) => {
  const points = [start, ...stops, end].filter(hasCoordinates);
  let km = 0;
  for (let i = 1; i < points.length; i++) km += haversineKm(points[i - 1], points[i]);
  return km;
};
