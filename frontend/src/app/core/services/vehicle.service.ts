import { inject, Injectable } from "@angular/core";
import { ApiService } from "../api.service";
import { AvailableVehicle, DeviceTokenResponse, Vehicle, VehicleInput } from "../models/vehicle.model";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root"
})
export class VehicleService {
  private readonly api = inject(ApiService);

  getVehicles(includeInactive = false): Promise<Vehicle[]> {
    return this.api.get<Vehicle[]>("vehicle", { params: { includeInactive } });
  }

  /** Tracteurs actifs, pour le choix au démarrage d'une tournée (opérateur). */
  getAvailable(): Promise<AvailableVehicle[]> {
    return this.api.get<AvailableVehicle[]>("vehicle/available");
  }

  createVehicle(input: VehicleInput): Promise<Vehicle> {
    return this.api.post<Vehicle>("vehicle", input);
  }

  updateVehicle(id: number, input: Partial<VehicleInput>): Promise<Vehicle> {
    return this.api.put<Vehicle>(`vehicle/${id}`, input);
  }

  /** Nouveau jeton d'appareil ; l'ancien cesse de fonctionner immédiatement. */
  regenerateToken(id: number): Promise<DeviceTokenResponse> {
    return this.api.post<DeviceTokenResponse>(`vehicle/${id}/token`, {});
  }

  /** Adresse à saisir dans Traccar Client (« URL du serveur »). */
  get serverUrl(): string {
    return new URL(`${environment.apiUrl}/tracking/osmand`, window.location.origin).toString();
  }
}
