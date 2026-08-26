import { inject, Injectable } from "@angular/core";
import { ApiService } from "../api.service";
import { Contract, RolloverResult } from "../models/domain.model";

export interface ContractFilters {
  seasonYear?: number;
  status?: string;
  routeId?: number;
  clientId?: number;
}

@Injectable({
  providedIn: "root"
})
export class ContractService {
  private readonly api = inject(ApiService);

  getContracts(filters: ContractFilters = {}): Promise<Contract[]> {
    const params = Object.entries(filters)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
      .join("&");
    return this.api.get<Contract[]>(`contract${params ? "?" + params : ""}`);
  }

  getContract(id: number): Promise<Contract> {
    return this.api.get<Contract>(`contract/${id}`);
  }

  createContract(contract: Partial<Contract>): Promise<Contract> {
    return this.api.post<Contract>("contract", contract);
  }

  updateContract(id: number, contract: Partial<Contract>): Promise<Contract> {
    return this.api.put<Contract>(`contract/${id}`, contract);
  }

  cancelContract(id: number): Promise<Contract> {
    return this.api.delete<Contract>(`contract/${id}`);
  }

  rolloverSeason(fromSeasonYear: number): Promise<RolloverResult> {
    return this.api.post<RolloverResult>("contract/rollover", { fromSeasonYear });
  }
}
