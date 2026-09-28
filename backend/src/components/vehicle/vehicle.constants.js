/** Provenance des positions d'un véhicule. */
export const VEHICLE_SOURCE = {
  /** Protocole OsmAnd : Traccar Client sur un téléphone, ou un ESP32 cellulaire. */
  OSMAND: "osmand",
  /** API CNH FieldOps (tracteur Case) — phase G6. */
  FIELDOPS: "fieldops"
};

export const VEHICLE_SOURCES = Object.values(VEHICLE_SOURCE);

/** Octets aléatoires du jeton d'appareil (encodé base64url → 43 caractères). */
export const DEVICE_TOKEN_BYTES = 32;

export const VEHICLE_NAME_MAX_LENGTH = 100;
