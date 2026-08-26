import { inject, Injectable } from "@angular/core";
import { ApiService } from "../api.service";
import { Contract, RouteModel } from "../models/domain.model";

@Injectable({
  providedIn: "root"
})
export class RouteService {
  private readonly api = inject(ApiService);

  getRoutes(): Promise<RouteModel[]> {
    return this.api.get<RouteModel[]>("route");
  }

  getRoute(id: number): Promise<RouteModel> {
    return this.api.get<RouteModel>(`route/${id}`);
  }

  getRouteContracts(id: number): Promise<Contract[]> {
    return this.api.get<Contract[]>(`route/${id}/contracts`);
  }

  createRoute(route: Partial<RouteModel>): Promise<RouteModel> {
    return this.api.post<RouteModel>("route", route);
  }

  updateRoute(id: number, route: Partial<RouteModel>): Promise<RouteModel> {
    return this.api.put<RouteModel>(`route/${id}`, route);
  }

  deactivateRoute(id: number): Promise<void> {
    return this.api.delete<void>(`route/${id}`);
  }
}
