import { inject, Injectable } from "@angular/core";
import { ApiService } from "../api.service";
import { CurrentRunResponse, MyRoute, RouteRun, RouteRunStop, RouteRunStopStatus } from "../models/route-run.model";

@Injectable({
  providedIn: "root"
})
export class RouteRunService {
  private readonly api = inject(ApiService);

  getMyRoutes(): Promise<MyRoute[]> {
    return this.api.get<MyRoute[]>("route-run/my-routes");
  }

  getCurrentRun(routeId: number): Promise<CurrentRunResponse> {
    return this.api.get<CurrentRunResponse>(`route-run/route/${routeId}/current`);
  }

  start(routeId: number): Promise<RouteRun> {
    return this.api.post<RouteRun>("route-run/start", { routeId });
  }

  updateStop(stopId: number, status: RouteRunStopStatus): Promise<RouteRunStop> {
    return this.api.put<RouteRunStop>(`route-run/stops/${stopId}`, { status });
  }

  complete(runId: number): Promise<RouteRun> {
    return this.api.post<RouteRun>(`route-run/${runId}/complete`, {});
  }
}
