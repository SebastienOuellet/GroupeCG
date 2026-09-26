import { inject, Injectable } from "@angular/core";
import { ApiService } from "../api.service";
import { Invoice, InvoiceType } from "../models/invoice.model";
import { ContractItem } from "../models/domain.model";

export interface InvoiceFilters {
  contractId?: number;
  clientId?: number;
  type?: InvoiceType;
  status?: string;
  /** Année d'émission (date d'envoi). */
  year?: number;
}

@Injectable({
  providedIn: "root"
})
export class InvoiceService {
  private readonly api = inject(ApiService);

  getInvoices(filters: InvoiceFilters = {}): Promise<Invoice[]> {
    const params = Object.entries(filters)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
      .join("&");
    return this.api.get<Invoice[]>(`invoice${params ? "?" + params : ""}`);
  }

  getInvoice(id: number): Promise<Invoice> {
    return this.api.get<Invoice>(`invoice/${id}`);
  }

  /** Génère la facture brouillon d'un contrat à partir de ses lignes. */
  createFromContract(contractId: number): Promise<Invoice> {
    return this.api.post<Invoice>("invoice", { contractId });
  }

  /** Facture de service : travaux hors contrat, lignes saisies à la main. */
  createServiceInvoice(request: { clientId: number; items: ContractItem[]; notes?: string; dueDate?: string }): Promise<Invoice> {
    return this.api.post<Invoice>("invoice", request);
  }

  /** `items` : facture de service en brouillon seulement. */
  updateInvoice(id: number, changes: { dueDate?: string | null; notes?: string | null; items?: ContractItem[] }): Promise<Invoice> {
    return this.api.put<Invoice>(`invoice/${id}`, changes);
  }

  markSent(id: number, dueDate?: string): Promise<Invoice> {
    return this.api.post<Invoice>(`invoice/${id}/send`, { dueDate });
  }

  markPaid(id: number): Promise<Invoice> {
    return this.api.post<Invoice>(`invoice/${id}/mark-paid`, {});
  }

  /** Annule une facture envoyée et en crée une nouvelle à partir du contrat actuel. */
  replaceInvoice(id: number): Promise<Invoice> {
    return this.api.post<Invoice>(`invoice/${id}/replace`, {});
  }

  cancelInvoice(id: number): Promise<Invoice> {
    return this.api.delete<Invoice>(`invoice/${id}`);
  }
}
