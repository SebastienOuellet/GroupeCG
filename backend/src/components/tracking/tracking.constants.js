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
  liveTrailMinutes: 30,
  /** « Fait » automatique quand le tracteur repart d'une entrée. Désactivé : les durées sont quand même enregistrées. */
  autoCompleteStops: true,
  /** Rayon d'arrivée autour du pin de l'adresse (m). */
  geofenceRadiusM: 35,
  /** Hystérésis : on considère le tracteur reparti au-delà de rayon + marge (évite les allers-retours au bord). */
  exitMarginM: 25,
  /** En dessous, c'est un simple passage devant l'adresse, pas un déneigement. */
  minDwellSeconds: 45,
  /** Arrêts à faire (dans l'ordre) où l'on cherche une arrivée : évite de confondre avec une adresse plus loin sur la route. */
  lookaheadStops: 3,
  /** Le client voit le tracteur et « X arrêts avant le vôtre » dans le portail pendant une tournée. */
  portalTrackingEnabled: true
};

/** Réglages numériques (entiers) et leurs bornes ; les booléens sont dans TRACKING_BOOLEAN_SETTINGS. */
export const TRACKING_LIMITS = {
  positionRetentionDays: { min: 1, max: 365 },
  liveTrailMinutes: { min: 5, max: 240 },
  geofenceRadiusM: { min: 10, max: 200 },
  exitMarginM: { min: 5, max: 200 },
  minDwellSeconds: { min: 10, max: 1800 },
  lookaheadStops: { min: 1, max: 10 }
};

export const TRACKING_BOOLEAN_SETTINGS = ["autoCompleteStops", "portalTrackingEnabled"];

/** Après la tournée, le portail montre encore « Votre entrée a été déneigée à … » pendant ce délai. */
export const PORTAL_RECENT_VISIT_HOURS = 12;

/** Au-delà, une position est trop imprécise pour décider d'une arrivée (gardée pour la carte). */
export const GEOFENCE_MAX_ACCURACY_M = 100;
/** Positions consécutives requises pour confirmer une arrivée ou un départ (filtre les sauts GPS). */
export const GEOFENCE_CONFIRMATIONS = 2;

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
