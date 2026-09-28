/** Provenance d'une position enregistrée. */
export const POSITION_SOURCE = {
  /** Traccar Client ou ESP32 (protocole OsmAnd). */
  OSMAND: "osmand",
  /** GPS du téléphone de l'opérateur, par la page de tournée (écran allumé seulement). */
  BROWSER: "browser",
  /** API CNH FieldOps (phase G6). */
  FIELDOPS: "fieldops"
};

export const POSITION_SOURCES = Object.values(POSITION_SOURCE);

/** Réglages du suivi (clé Settings `tracking`), défauts du code surchargés clé par clé. */
export const DEFAULT_TRACKING_SETTINGS = {
  /** Positions brutes conservées N jours, puis purgées (Loi 25). Les durées par arrêt restent. */
  positionRetentionDays: 30,
  /** Traînée affichée derrière chaque tracteur sur la carte en direct. */
  liveTrailMinutes: 30
};

export const TRACKING_LIMITS = {
  positionRetentionDays: { min: 1, max: 365 },
  liveTrailMinutes: { min: 5, max: 240 }
};

/** Garde-fous sur les positions reçues. */
export const POSITION_RULES = {
  /** Positions par requête (tampon d'un appareil qui retrouve le réseau). */
  maxPerRequest: 500,
  /** Horloge d'appareil en avance tolérée. */
  maxFutureSkewMs: 5 * 60 * 1000,
  /** Positions acceptées un peu avant le démarrage (horloges décalées), jamais plus tôt : hors quart de travail. */
  maxBeforeRunStartMs: 2 * 60 * 1000
};

/** Sans position depuis ce délai, la carte et la vue opérateur signalent un appareil muet. */
export const STALE_POSITION_MS = 2 * 60 * 1000;

export const KNOTS_TO_KMH = 1.852;
export const MPS_TO_KMH = 3.6;
