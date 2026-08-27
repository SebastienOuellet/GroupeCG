import { Component, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { ContractService } from "../../../core/services/contract.service";
import { RouteService } from "../../../core/services/route.service";
import { InvoiceService } from "../../../core/services/invoice.service";
import { Contract, RouteModel } from "../../../core/models/domain.model";
import { Invoice } from "../../../core/models/invoice.model";

@Component({
  selector: "app-contract-detail",
  imports: [FormsModule, RouterLink],
  templateUrl: "./contract-detail.html"
})
export class ContractDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly contractService = inject(ContractService);
  private readonly routeService = inject(RouteService);
  private readonly invoiceService = inject(InvoiceService);

  readonly contract = signal<Contract | null>(null);
  readonly routes = signal<RouteModel[]>([]);
  readonly invoices = signal<Invoice[]>([]);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly showInvoiceForm = signal(false);

  form: Partial<Contract> = {};
  invoiceForm: { amount?: number; dueDate?: string; notes?: string } = {};

  private contractId!: number;

  async ngOnInit(): Promise<void> {
    this.contractId = Number(this.route.snapshot.paramMap.get("id"));
    try {
      const [contract, routes, invoices] = await Promise.all([
        this.contractService.getContract(this.contractId),
        this.routeService.getRoutes(),
        this.invoiceService.getInvoices({ contractId: this.contractId })
      ]);
      this.contract.set(contract);
      this.routes.set(routes);
      this.invoices.set(invoices);
      this.form = { ...contract };
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  openInvoiceForm(): void {
    this.invoiceForm = {};
    this.showInvoiceForm.set(true);
  }

  async saveInvoice(): Promise<void> {
    if (!this.invoiceForm.amount) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.invoiceService.createInvoice({
        contractId: this.contractId,
        amount: Number(this.invoiceForm.amount),
        dueDate: this.invoiceForm.dueDate || undefined,
        notes: this.invoiceForm.notes || undefined
      });
      this.showInvoiceForm.set(false);
      this.invoices.set(await this.invoiceService.getInvoices({ contractId: this.contractId }));
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  async markInvoicePaid(invoice: Invoice): Promise<void> {
    try {
      await this.invoiceService.markPaid(invoice.Id);
      this.invoices.set(await this.invoiceService.getInvoices({ contractId: this.contractId }));
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.contractService.updateContract(this.contractId, {
        RouteId: this.form.RouteId ? Number(this.form.RouteId) : null,
        StartDate: this.form.StartDate,
        EndDate: this.form.EndDate,
        Price: this.form.Price,
        Status: this.form.Status,
        Notes: this.form.Notes
      });
      this.contract.set(await this.contractService.getContract(this.contractId));
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
