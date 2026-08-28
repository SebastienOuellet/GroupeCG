import { Contract, RouteModel } from "./domain.model";

export type RouteRunStatus = "in_progress" | "completed" | "cancelled";
export type RouteRunStopStatus = "pending" | "done" | "skipped";

export interface RouteRunStop {
  Id: number;
  RouteRunId: number;
  ContractId: number;
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
