import { Component, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { InvoiceService } from "../../../core/services/invoice.service";
import { ContractService } from "../../../core/services/contract.service";
import { Invoice } from "../../../core/models/invoice.model";
import { Contract } from "../../../core/models/domain.model";

@Component({
  selector: "app-invoices-list",
  imports: [FormsModule],
  templateUrl: "./invoices-list.html"
})
export class InvoicesList implements OnInit {
  private readonly invoiceService = inject(InvoiceService);
  private readonly contractService = inject(ContractService);

  readonly invoices = signal<Invoice[]>([]);
  readonly contracts = signal<Contract[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly showForm = signal(false);
  readonly saving = signal(false);

  filters = { status: "" };
  form: { contractId?: number; amount?: number; dueDate?: string; notes?: string } = {};

  async ngOnInit(): Promise<void> {
    await Promise.all([this.load(), this.loadContracts()]);
  }

  async loadContracts(): Promise<void> {
    this.contracts.set(await this.contractService.getContracts());
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.invoices.set(await this.invoiceService.getInvoices({ status: this.filters.status || undefined }));
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  openForm(): void {
    this.form = {};
    this.showForm.set(true);
  }

  async save(): Promise<void> {
    if (!this.form.contractId || !this.form.amount) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.invoiceService.createInvoice({
        contractId: Number(this.form.contractId),
        amount: Number(this.form.amount),
        dueDate: this.form.dueDate || undefined,
        notes: this.form.notes || undefined
      });
      this.showForm.set(false);
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  async markPaid(invoice: Invoice): Promise<void> {
    try {
      await this.invoiceService.markPaid(invoice.Id);
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  async cancel(invoice: Invoice): Promise<void> {
    if (!confirm(`Annuler la facture ${invoice.InvoiceNumber} ?`)) return;
    try {
      await this.invoiceService.cancelInvoice(invoice.Id);
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  clientLabel(invoice: Invoice): string {
    const client = invoice.Contract?.Client;
    if (!client) return "—";
    const person = [client.FirstName, client.LastName].filter(Boolean).join(" ");
    return client.CompanyName || person || `#${client.ClientNumber}`;
  }

  contractLabel(contract: Contract): string {
    return `${contract.Reference} — ${this.clientLabelFor(contract)}`;
  }

  private clientLabelFor(contract: Contract): string {
    const client = contract.Client;
    if (!client) return "?";
    const person = [client.FirstName, client.LastName].filter(Boolean).join(" ");
    return client.CompanyName || person || `#${client.ClientNumber}`;
  }
}
