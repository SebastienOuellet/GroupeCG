import { KNOTS_TO_KMH, MPS_TO_KMH } from "../components/tracking/tracking.constants.js";

/**
 * Lecture du protocole OsmAnd, tel que l'envoient Traccar Client et nos ESP32.
 *
 * Deux formats :
 *  - paramètres (GET ou POST, query ou formulaire) : id, lat, lon | location="lat,lon",
 *    timestamp (s, ms ou ISO), speed (NŒUDS), bearing | heading, accuracy, batt (%) ;
 *  - JSON (Traccar Client 9+) : { device_id, location: { timestamp, coords: { latitude,
 *    longitude, speed (M/S), heading, accuracy }, battery: { level 0-1 } } }.
 *    `location` peut aussi être un tableau (tampon vidé d'un coup).
 *
 * Retourne { deviceId, positions[] } avec des positions brutes normalisées
 * (validation des bornes : voir normalizePosition dans tracking.service).
 */
export const parseOsmAnd = ({ query = {}, body = {} }) => {
  const json = body && typeof body === "object" && body.location ? body : null;
  if (json) {
    const locations = Array.isArray(json.location) ? json.location : [json.location];
    return {
      deviceId: stringOrNull(json.device_id ?? json.deviceid ?? query.id),
      positions: locations.map(fromJsonLocation)
    };
  }

  const params = { ...query, ...(body && typeof body === "object" ? body : {}) };
  let latitude = params.lat;
  let longitude = params.lon;
  if ((latitude == null || longitude == null) && typeof params.location === "string") {
    [latitude, longitude] = params.location.split(",");
  }
  return {
    deviceId: stringOrNull(params.id ?? params.deviceid),
    positions: [
      {
        latitude: toNumber(latitude),
        longitude: toNumber(longitude),
        recordedAt: parseTimestamp(params.timestamp),
        speedKmh: scale(toNumber(params.speed), KNOTS_TO_KMH),
        heading: toNumber(params.bearing ?? params.heading),
        accuracyM: toNumber(params.accuracy),
        batteryPercent: toNumber(params.batt)
      }
    ]
  };
};

const fromJsonLocation = (location = {}) => {
  const coords = location.coords ?? {};
  const level = toNumber(location.battery?.level);
  return {
    latitude: toNumber(coords.latitude),
    longitude: toNumber(coords.longitude),
    recordedAt: parseTimestamp(location.timestamp),
    speedKmh: scale(toNumber(coords.speed), MPS_TO_KMH),
    heading: toNumber(coords.heading),
    accuracyM: toNumber(coords.accuracy),
    batteryPercent: level == null ? null : level * 100
  };
};

const stringOrNull = (value) => (value == null || value === "" ? null : String(value));

const toNumber = (value) => {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const scale = (value, factor) => (value == null ? null : value * factor);

/** Secondes, millisecondes ou texte de date ; null si absent ou illisible (le service prend alors l'heure du serveur). */
export const parseTimestamp = (value) => {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (Number.isFinite(number)) {
    // En dessous de ~2001 en ms, c'est forcément des secondes
    return new Date(number < 1e12 ? number * 1000 : number);
  }
  // « yyyy-MM-dd HH:mm:ss » (sans fuseau) : traité comme UTC, comme Traccar
  const text = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(" ", "T")}Z` : value;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};
