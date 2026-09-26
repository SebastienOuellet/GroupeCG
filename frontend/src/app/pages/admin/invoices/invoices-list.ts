import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { InvoiceService } from "../../../core/services/invoice.service";
import { Invoice, INVOICE_STATUS_LABELS, INVOICE_TYPE_LABELS, ISSUED_STATUSES } from "../../../core/models/invoice.model";
import { formatMoney } from "../../../core/models/billing";

/** Statuts qui comptent dans le chiffre d'affaires : émises et non annulées. */
const REVENUE_STATUSES = ["sent", "overdue", "paid"];

const cents = (value: string | number | null | undefined) => Math.round(Number(value || 0) * 100);

@Component({
  selector: "app-invoices-list",
  imports: [FormsModule, RouterLink],
  templateUrl: "./invoices-list.html"
})
export class InvoicesList implements OnInit {
  private readonly invoiceService = inject(InvoiceService);
  private readonly router = inject(Router);

  readonly invoices = signal<Invoice[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly currentYear = new Date().getFullYear();
  readonly years = [this.currentYear + 1, this.currentYear, this.currentYear - 1, this.currentYear - 2];
  readonly statusLabels = INVOICE_STATUS_LABELS;
  readonly typeLabels = INVOICE_TYPE_LABELS;
  readonly formatMoney = formatMoney;

  filters = { year: String(this.currentYear), status: "", type: "" };

  /** Bilan des factures affichées : sert à la fin d'année (revenus, TPS/TVQ perçues, comptes à recevoir). */
  readonly summary = computed(() => {
    const revenue = this.invoices().filter((invoice) => REVENUE_STATUSES.includes(invoice.Status));
    const sum = (list: Invoice[], field: keyof Invoice) => list.reduce((total, invoice) => total + cents(invoice[field] as string), 0) / 100;
    const receivable = revenue.filter((invoice) => ISSUED_STATUSES.includes(invoice.Status));
    const paid = revenue.filter((invoice) => invoice.Status === "paid");
    return {
      count: revenue.length,
      subtotal: sum(revenue, "Subtotal"),
      tps: sum(revenue, "TpsAmount"),
      tvq: sum(revenue, "TvqAmount"),
      total: sum(revenue, "Amount"),
      paid: sum(paid, "Amount"),
      paidCount: paid.length,
      receivable: sum(receivable, "Amount"),
      receivableCount: receivable.length
    };
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.invoices.set(
        await this.invoiceService.getInvoices({
          year: this.filters.year ? Number(this.filters.year) : undefined,
          status: this.filters.status || undefined,
          type: (this.filters.type || undefined) as Invoice["Type"] | undefined
        })
      );
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  private async run(action: () => Promise<unknown>): Promise<void> {
    this.error.set(null);
    try {
      await action();
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  open(invoice: Invoice): void {
    this.router.navigate(["/factures", invoice.Id]);
  }

  markPaid(invoice: Invoice): Promise<void> {
    if (!confirm(`Marquer la facture ${invoice.InvoiceNumber} comme payée (${formatMoney(invoice.Amount)}) ?`)) return Promise.resolve();
    return this.run(() => this.invoiceService.markPaid(invoice.Id));
  }

  isIssued(invoice: Invoice): boolean {
    return ISSUED_STATUSES.includes(invoice.Status);
  }

  clientLabel(invoice: Invoice): string {
    const client = invoice.Client ?? invoice.Contract?.Client;
    if (!client) return "—";
    const person = [client.FirstName, client.LastName].filter(Boolean).join(" ");
    return client.CompanyName || person || `#${client.ClientNumber}`;
  }

  /** Export CSV des factures affichées (séparateur « ; » et virgule décimale : s'ouvre tel quel dans Excel fr-CA). */
  exportCsv(): void {
    const decimal = (value: string | null | undefined) => Number(value || 0).toFixed(2).replace(".", ",");
    const escape = (value: string | number | null | undefined) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const header = ["Numéro", "Type", "Date d'envoi", "Échéance", "Payée le", "Annulée le", "Statut", "Client", "No client", "Contrat", "Sous-total", "TPS", "TVQ", "Total", "Remplace"];
    const rows = [...this.invoices()]
      .sort((a, b) => a.InvoiceNumber.localeCompare(b.InvoiceNumber))
      .map((invoice) => [
        invoice.InvoiceNumber,
        this.typeLabels[invoice.Type],
        invoice.IssuedAt,
        invoice.DueDate,
        invoice.PaidAt,
        invoice.CancelledAt,
        this.statusLabels[invoice.Status],
        this.clientLabel(invoice),
        (invoice.Client ?? invoice.Contract?.Client)?.ClientNumber,
        invoice.Contract?.Reference,
        decimal(invoice.Subtotal),
        decimal(invoice.TpsAmount),
        decimal(invoice.TvqAmount),
        decimal(invoice.Amount),
        invoice.ReplacesInvoice?.InvoiceNumber
      ].map(escape).join(";"));

    // BOM UTF-8 : Excel affiche correctement les accents
    const blob = new Blob(["﻿" + [header.map(escape).join(";"), ...rows].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `factures-${this.filters.year || "toutes"}${this.filters.type ? "-" + this.filters.type : ""}${this.filters.status ? "-" + this.filters.status : ""}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
