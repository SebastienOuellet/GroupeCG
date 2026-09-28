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
}
