import { inject, Injectable } from "@angular/core";
import { ApiService } from "../api.service";
import { Invoice } from "../models/invoice.model";
import { Contract, ContractUpdate, RolloverResult } from "../models/domain.model";

export interface ContractSendResult {
  sentTo: string;
  /** Vrai si NOTIFICATIONS_DRY_RUN : le courriel a seulement été journalisé. */
  dryRun: boolean;
  invoice: Invoice;
}

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

  createContract(contract: ContractUpdate): Promise<Contract> {
    return this.api.post<Contract>("contract", contract);
  }

  /** Descriptions de lignes déjà utilisées (autocomplétion). */
  getItemSuggestions(): Promise<string[]> {
    return this.api.get<string[]>("contract/item-suggestions");
  }

  updateContract(id: number, contract: ContractUpdate): Promise<Contract> {
    return this.api.put<Contract>(`contract/${id}`, contract);
  }

  cancelContract(id: number): Promise<Contract> {
    return this.api.delete<Contract>(`contract/${id}`);
  }

  /** PDF du contrat. `dueDate` : échéance à afficher tant que le contrat n'est pas envoyé. */
  getDocument(id: number, dueDate?: string): Promise<Blob> {
    return this.api.getBlob(`contract/${id}/document`, { params: dueDate ? { dueDate } : {} });
  }

  /** Envoie le contrat PDF au client par courriel et le marque envoyé. */
  sendToClient(id: number, dueDate?: string): Promise<ContractSendResult> {
    return this.api.post<ContractSendResult>(`contract/${id}/send`, { dueDate });
  }

  rolloverSeason(fromSeasonYear: number): Promise<RolloverResult> {
    return this.api.post<RolloverResult>("contract/rollover", { fromSeasonYear });
  }
}
