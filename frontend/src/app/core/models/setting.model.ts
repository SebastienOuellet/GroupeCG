import { NamedLocation } from "./location.model";

/** Valeurs imprimées dans les conditions du contrat (Paramètres › Contrat). */
export interface ContractTerms {
  minSnowfallCm: number;
  maxSnowfallCm: number;
  regionalAverageCm: number;
  lateStormSurchargePercent: number;
  abrasiveCallFrom: number;
  abrasiveBarrelSeason: number;
  abrasiveBarrelRefill: number;
  abrasiveOptionFrom: number;
  signatureDeadlineMonth: number;
  signatureDeadlineDay: number;
}

export interface ContractTermsResponse {
  values: ContractTerms;
  /** Valeurs du contrat papier 2025-2026 (bouton « Rétablir »). */
  defaults: ContractTerms;
  /** null = jamais modifiées (valeurs par défaut). */
  updatedAt: string | null;
}

/** Dépôt par défaut des routes (Paramètres › Routes). `value` null = pas encore configuré. */
export interface RouteDepotResponse {
  value: NamedLocation | null;
  updatedAt: string | null;
}

/** Paramètres de l'optimiseur (Paramètres › Routes). Clés : revêtements + "unknown", tailles d'entrée. */
export interface RouteOptimizationSettings {
  visitMinutesBySurface: Record<string, number>;
  sizeFactors: Record<string, number>;
  /** HH:MM, heure de l'Est. */
  departureTime: string;
}

export interface RouteOptimizationSettingsResponse {
  values: RouteOptimizationSettings;
  defaults: RouteOptimizationSettings;
  updatedAt: string | null;
}

/** Réglages du suivi GPS des tracteurs (clé Settings `tracking`). */
export interface TrackingSettings {
  positionRetentionDays: number;
  liveTrailMinutes: number;
  autoCompleteStops: boolean;
  geofenceRadiusM: number;
  exitMarginM: number;
  minDwellSeconds: number;
  lookaheadStops: number;
}

export interface TrackingSettingsResponse {
  values: TrackingSettings;
  defaults: TrackingSettings;
  updatedAt: string | null;
}
