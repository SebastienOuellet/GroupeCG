import { inject, Injectable } from "@angular/core";
import { ApiService } from "../api.service";
import { Invoice } from "../models/invoice.model";

export interface InvoiceFilters {
  contractId?: number;
  status?: string;
}

export interface CreateInvoiceRequest {
  contractId: number;
  amount: number;
  dueDate?: string;
  notes?: string;
  status?: string;
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

  createInvoice(request: CreateInvoiceRequest): Promise<Invoice> {
    return this.api.post<Invoice>("invoice", request);
  }

  updateInvoice(id: number, invoice: Partial<Invoice> & { status?: string }): Promise<Invoice> {
    return this.api.put<Invoice>(`invoice/${id}`, invoice);
  }

  markPaid(id: number): Promise<Invoice> {
    return this.api.post<Invoice>(`invoice/${id}/mark-paid`, {});
  }

  cancelInvoice(id: number): Promise<Invoice> {
    return this.api.delete<Invoice>(`invoice/${id}`);
  }
}
