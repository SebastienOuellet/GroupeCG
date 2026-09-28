import { Contract, RouteModel } from "./domain.model";
import { TrackingSignal } from "./tracking.model";

export type RouteRunStatus = "in_progress" | "completed" | "cancelled";
export type RouteRunStopStatus = "pending" | "done" | "skipped";

export interface RouteRunStop {
  Id: number;
  RouteRunId: number;
  ContractId: number;
  /** Ordre figé au démarrage de la tournée. */
  Sequence: number;
  Status: RouteRunStopStatus;
  DoneAt: string | null;
  /** manual = coché par l'opérateur ; auto_gps = détecté par le géorepérage. */
  DoneSource: "manual" | "auto_gps" | null;
  /** Détectés par GPS : arrivée dans l'entrée et départ. */
  ArrivedAt: string | null;
  DepartedAt: string | null;
  ServiceSeconds: number | null;
  TravelSeconds: number | null;
  Notes: string | null;
  Contract?: Contract;
}

export interface RouteRun {
  Id: number;
  RouteId: number;
  OperatorUserId: number;
  Status: RouteRunStatus;
  StartedAt: string;
  CompletedAt: string | null;
  NotificationBatchId: number | null;
  /** Tracteur de la tournée (null = GPS du téléphone seulement). */
  VehicleId: number | null;
  Vehicle?: { Id: number; Name: string } | null;
  /** État du suivi GPS (tournée en cours seulement). */
  Signal?: TrackingSignal;
  /** Dernière position reçue (appareil du tracteur ou téléphone), pour la carte. */
  LastPosition?: { latitude: number; longitude: number; heading: number | null; recordedAt: string } | null;
  Route?: RouteModel;
  Stops?: RouteRunStop[];
}

/** Route assignée à l'opérateur, avec sa tournée en cours (0 ou 1). */
export interface MyRoute extends RouteModel {
  Runs: RouteRun[];
}

export interface CurrentRunResponse {
  route: RouteModel;
  run: RouteRun | null;
  /** Départ et retour de la route (point d'attache, sinon dépôt) ; null si non configuré. */
  endpoint?: { label: string; latitude: number; longitude: number } | null;
}
