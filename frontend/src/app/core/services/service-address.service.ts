import { inject, Injectable } from "@angular/core";
import { ApiService } from "../api.service";
import { ServiceAddress } from "../models/domain.model";

@Injectable({
  providedIn: "root"
})
export class ServiceAddressService {
  private readonly api = inject(ApiService);

  getAddresses(clientId?: number): Promise<ServiceAddress[]> {
    const query = clientId ? `?clientId=${clientId}` : "";
    return this.api.get<ServiceAddress[]>(`service-address${query}`);
  }

  getAddress(id: number): Promise<ServiceAddress> {
    return this.api.get<ServiceAddress>(`service-address/${id}`);
  }

  createAddress(address: Partial<ServiceAddress>): Promise<ServiceAddress> {
    return this.api.post<ServiceAddress>("service-address", address);
  }

  updateAddress(id: number, address: Partial<ServiceAddress>): Promise<ServiceAddress> {
    return this.api.put<ServiceAddress>(`service-address/${id}`, address);
  }

  deactivateAddress(id: number): Promise<void> {
    return this.api.delete<void>(`service-address/${id}`);
  }
}
