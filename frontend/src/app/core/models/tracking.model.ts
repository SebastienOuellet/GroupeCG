export type PositionSource = "osmand" | "browser" | "fieldops";

export interface TrackedPosition {
  latitude: number;
  longitude: number;
  speedKmh: number | null;
  heading: number | null;
  accuracyM: number | null;
  source: PositionSource;
  recordedAt: string;
}

/** État du suivi d'une tournée : dernière position reçue, muet si trop vieille. */
export interface TrackingSignal {
  lastPositionAt: string | null;
  source?: PositionSource;
  isStale: boolean;
}

export interface LiveStop {
  id: number;
  sequence: number;
  status: "pending" | "done" | "skipped";
  doneAt: string | null;
  doneSource: "manual" | "auto_gps" | null;
  /** Tracteur dans l'entrée depuis (arrêt encore à faire). */
  arrivedAt: string | null;
  reference: string | null;
  address: { label: string; city: string; latitude: number | null; longitude: number | null } | null;
}

export interface LiveRun {
  id: number;
  startedAt: string;
  route: { id: number; name: string } | null;
  operator: { id: number; name: string } | null;
  vehicle: { id: number; name: string; batteryPercent: number | null } | null;
  doneCount: number;
  totalCount: number;
  lastPosition: TrackedPosition | null;
  signal: TrackingSignal;
  /** [lat, lng] des dernières minutes, du plus vieux au plus récent. */
  trail: [number, number][];
  stops: LiveStop[];
}

export interface LiveTrackingResponse {
  generatedAt: string;
  staleAfterMs: number;
  runs: LiveRun[];
}

/** Position envoyée par le GPS du téléphone de l'opérateur. */
export interface BrowserPosition {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  speedKmh: number | null;
  heading: number | null;
  recordedAt: string;
}

export interface IngestResult {
  accepted: number;
  rejected: number;
}
