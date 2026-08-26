import { inject, Injectable } from "@angular/core";
import { ApiService } from "../api.service";
import { Tenant } from "../models/domain.model";

@Injectable({
  providedIn: "root"
})
export class TenantService {
  private readonly api = inject(ApiService);

  getTenants(serviceAddressId?: number): Promise<Tenant[]> {
    const query = serviceAddressId ? `?serviceAddressId=${serviceAddressId}` : "";
    return this.api.get<Tenant[]>(`tenant${query}`);
  }

  createTenant(tenant: Partial<Tenant>): Promise<Tenant> {
    return this.api.post<Tenant>("tenant", tenant);
  }

  updateTenant(id: number, tenant: Partial<Tenant>): Promise<Tenant> {
    return this.api.put<Tenant>(`tenant/${id}`, tenant);
  }

  deactivateTenant(id: number): Promise<void> {
    return this.api.delete<void>(`tenant/${id}`);
  }
}
