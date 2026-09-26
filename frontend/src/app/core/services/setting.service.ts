import { inject, Injectable } from "@angular/core";
import { ApiService } from "../api.service";
import { ContractTerms, ContractTermsResponse } from "../models/setting.model";

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
}
