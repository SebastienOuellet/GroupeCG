import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { InvoiceService } from "../../../core/services/invoice.service";
import { ContractService } from "../../../core/services/contract.service";
import { ContractItem } from "../../../core/models/domain.model";
import { Invoice, INVOICE_STATUS_LABELS, INVOICE_TYPE_LABELS, ISSUED_STATUSES } from "../../../core/models/invoice.model";
import { formatMoney, withoutBlankItems } from "../../../core/models/billing";
import { ContractItemsEditor } from "../../../shared/contract-items-editor/contract-items-editor";

@Component({
  selector: "app-invoice-detail",
  imports: [FormsModule, RouterLink, ContractItemsEditor],
  templateUrl: "./invoice-detail.html",
  styleUrl: "./invoice-detail.scss"
})
export class InvoiceDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly invoiceService = inject(InvoiceService);
  private readonly contractService = inject(ContractService);

  readonly invoice = signal<Invoice | null>(null);
  readonly items = signal<ContractItem[]>([]);
  readonly itemSuggestions = signal<string[]>([]);
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);
  readonly saving = signal(false);

  /** Seules les factures de service en brouillon ont des lignes modifiables ici. */
  readonly editableLines = computed(() => {
    const invoice = this.invoice();
    return invoice?.Type === "service" && invoice.Status === "draft";
  });

  readonly statusLabels = INVOICE_STATUS_LABELS;
  readonly typeLabels = INVOICE_TYPE_LABELS;
  readonly formatMoney = formatMoney;

  dueDate = "";
  notes = "";

  private invoiceId!: number;

  async ngOnInit(): Promise<void> {
    this.invoiceId = Number(this.route.snapshot.paramMap.get("id"));
    try {
      const [invoice, suggestions] = await Promise.all([
        this.invoiceService.getInvoice(this.invoiceId),
        this.contractService.getItemSuggestions()
      ]);
      this.itemSuggestions.set(suggestions);
      this.apply(invoice);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  private apply(invoice: Invoice): void {
    this.invoice.set(invoice);
    this.items.set((invoice.Lines ?? []).map((line) => ({
      Description: line.Description,
      Quantity: Number(line.Quantity),
      UnitPrice: Number(line.UnitPrice)
    })));
    this.dueDate = invoice.DueDate ?? "";
    this.notes = invoice.Notes ?? "";
  }

  clientLabel(invoice: Invoice): string {
    const client = invoice.Client;
    if (!client) return "—";
    const person = [client.FirstName, client.LastName].filter(Boolean).join(" ");
    return `#${client.ClientNumber} — ${client.CompanyName || person}`;
  }

  isIssued(invoice: Invoice): boolean {
    return ISSUED_STATUSES.includes(invoice.Status);
  }

  private async run(action: () => Promise<unknown>, message: string): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    this.info.set(null);
    try {
      await action();
      this.apply(await this.invoiceService.getInvoice(this.invoiceId));
      this.info.set(message);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  saveDraft(): Promise<void> {
    return this.run(
      () => this.invoiceService.updateInvoice(this.invoiceId, {
        items: this.editableLines() ? withoutBlankItems(this.items()) : undefined,
        dueDate: this.dueDate || null,
        notes: this.notes || null
      }),
      "Facture enregistrée."
    );
  }

  saveNotes(): Promise<void> {
    return this.run(() => this.invoiceService.updateInvoice(this.invoiceId, { notes: this.notes || null }), "Notes enregistrées.");
  }

  markSent(): Promise<void> {
    return this.run(
      () => this.invoiceService.markSent(this.invoiceId, this.dueDate || undefined),
      "Facture marquée envoyée. Son contenu est maintenant figé."
    );
  }

  markPaid(invoice: Invoice): Promise<void> {
    if (!confirm(`Marquer la facture ${invoice.InvoiceNumber} comme payée (${formatMoney(invoice.Amount)}) ?`)) return Promise.resolve();
    return this.run(() => this.invoiceService.markPaid(this.invoiceId), "Facture payée.");
  }

  cancel(invoice: Invoice): Promise<void> {
    if (!confirm(`Annuler la facture ${invoice.InvoiceNumber} ? Elle restera dans l'historique avec le statut « Annulée ».`)) return Promise.resolve();
    return this.run(() => this.invoiceService.cancelInvoice(this.invoiceId), "Facture annulée.");
  }
}
