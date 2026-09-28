import { inject, Injectable } from "@angular/core";
import { ApiService } from "../api.service";
import {
  ContractTerms,
  ContractTermsResponse,
  RouteDepotResponse,
  RouteOptimizationSettings,
  RouteOptimizationSettingsResponse,
  TrackingSettings,
  TrackingSettingsResponse
} from "../models/setting.model";
import { NamedLocation } from "../models/location.model";

@Injectable({
  providedIn: "root"
})
export class SettingService {
  private readonly api = inject(ApiService);

  getContractTerms(): Promise<ContractTermsResponse> {
    return this.api.get<ContractTermsResponse>("setting/contract-terms");
  }

  /** PDF d'un contrat fictif avec ces valeurs (enregistrées ou non). */
  previewContractTerms(terms: ContractTerms): Promise<Blob> {
    return this.api.postBlob("setting/contract-terms/preview", terms);
  }

  updateContractTerms(terms: ContractTerms): Promise<ContractTermsResponse> {
    return this.api.put<ContractTermsResponse>("setting/contract-terms", terms);
  }

  getRouteDepot(): Promise<RouteDepotResponse> {
    return this.api.get<RouteDepotResponse>("setting/route-depot");
  }

  updateRouteDepot(depot: NamedLocation): Promise<RouteDepotResponse> {
    return this.api.put<RouteDepotResponse>("setting/route-depot", depot);
  }

  getRouteOptimizationSettings(): Promise<RouteOptimizationSettingsResponse> {
    return this.api.get<RouteOptimizationSettingsResponse>("setting/route-optimization");
  }

  updateRouteOptimizationSettings(settings: RouteOptimizationSettings): Promise<RouteOptimizationSettingsResponse> {
    return this.api.put<RouteOptimizationSettingsResponse>("setting/route-optimization", settings);
  }

  getTrackingSettings(): Promise<TrackingSettingsResponse> {
    return this.api.get<TrackingSettingsResponse>("setting/tracking");
  }

  updateTrackingSettings(settings: TrackingSettings): Promise<TrackingSettingsResponse> {
    return this.api.put<TrackingSettingsResponse>("setting/tracking", settings);
  }
}
