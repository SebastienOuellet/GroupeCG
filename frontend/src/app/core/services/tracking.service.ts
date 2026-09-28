import { inject, Injectable } from "@angular/core";
import { ApiService } from "../api.service";
import { BrowserPosition, IngestResult, LiveTrackingResponse } from "../models/tracking.model";

@Injectable({
  providedIn: "root"
})
export class TrackingService {
  private readonly api = inject(ApiService);

  /** Tournées en cours avec position, traînée et état des arrêts (carte admin). */
  getLive(): Promise<LiveTrackingResponse> {
    return this.api.get<LiveTrackingResponse>("tracking/live");
  }

  /** Positions du GPS du téléphone de l'opérateur pour sa tournée. */
  sendPositions(runId: number, positions: BrowserPosition[]): Promise<IngestResult> {
    return this.api.post<IngestResult>(`tracking/runs/${runId}/positions`, { positions });
  }
}
