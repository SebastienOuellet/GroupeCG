import { Component, computed, ElementRef, inject, OnInit, signal, viewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { ContractService } from "../../../core/services/contract.service";
import { RouteService } from "../../../core/services/route.service";
import { InvoiceService } from "../../../core/services/invoice.service";
import { Contract, ContractInvoiceAction, ContractItem, RouteModel } from "../../../core/models/domain.model";
import { CONTRACT_PAYMENT_LABELS, Invoice, ISSUED_STATUSES } from "../../../core/models/invoice.model";
import { computeTotals, formatMoney, withoutBlankItems } from "../../../core/models/billing";
import { ContractItemsEditor } from "../../../shared/contract-items-editor/contract-items-editor";
import { PdfPreview } from "../../../shared/pdf-preview/pdf-preview";

/**
 * Question posée quand les éléments changent et qu'un montant à payer existe déjà.
 * Le contrat fait office de facture : en interne c'est un enregistrement Invoice
 * de type "contract" (numéro, taxes figées) qui sert au bilan de fin d'année.
 */
interface InvoiceQuestion {
  invoice: Invoice;
  mode: "update" | "replace";
  newTotal: number;
}

const toItemDraft = (item: ContractItem): ContractItem => ({
  Description: item.Description,
  Quantity: Number(item.Quantity),
  UnitPrice: Number(item.UnitPrice)
});

@Component({
  selector: "app-contract-detail",
  imports: [FormsModule, RouterLink, ContractItemsEditor, PdfPreview],
  templateUrl: "./contract-detail.html",
  styleUrl: "./contract-detail.scss"
})
export class ContractDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly contractService = inject(ContractService);
  private readonly routeService = inject(RouteService);
  private readonly invoiceService = inject(InvoiceService);

  private readonly questionDialog = viewChild<ElementRef<HTMLDialogElement>>("questionDialog");
  private readonly sendDialog = viewChild<ElementRef<HTMLDialogElement>>("sendDialog");

  /** Aperçu du contrat PDF dans le dialogue d'envoi (null = en chargement). */
  readonly previewPdf = signal<Blob | null>(null);
  readonly sendDialogOpen = signal(false);

  readonly contract = signal<Contract | null>(null);
  readonly routes = signal<RouteModel[]>([]);
  readonly invoices = signal<Invoice[]>([]);
  readonly itemSuggestions = signal<string[]>([]);
  readonly items = signal<ContractItem[]>([]);
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);
  readonly saving = signal(false);
  readonly question = signal<InvoiceQuestion | null>(null);

  /** Montant à payer en cours : le plus récent non annulé (au plus un par contrat). */
  readonly activeInvoice = computed(() =>
    [...this.invoices()].sort((a, b) => b.Id - a.Id).find((invoice) => invoice.Status !== "cancelled") ?? null
  );
  readonly cancelledInvoices = computed(() => this.invoices().filter((invoice) => invoice.Status === "cancelled"));

  readonly statusLabels = CONTRACT_PAYMENT_LABELS;
  /** Le client a choisi de ne pas mettre à jour le montant après une modification des éléments. */
  readonly amountOutOfSync = computed(() => {
    const invoice = this.activeInvoice();
    const contract = this.contract();
    return !!invoice && !!contract && invoice.Status !== "paid" && Number(invoice.Subtotal) !== Number(contract.Price);
  });
  readonly formatMoney = formatMoney;

  form: Partial<Contract> = {};
  dueDate = "";

  private contractId!: number;

  async ngOnInit(): Promise<void> {
    this.contractId = Number(this.route.snapshot.paramMap.get("id"));
    try {
      const [contract, routes, invoices, suggestions] = await Promise.all([
        this.contractService.getContract(this.contractId),
        this.routeService.getRoutes(),
        this.invoiceService.getInvoices({ contractId: this.contractId }),
        this.contractService.getItemSuggestions()
      ]);
      this.routes.set(routes);
      this.invoices.set(invoices);
      this.itemSuggestions.set(suggestions);
      this.applyContract(contract);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  private applyContract(contract: Contract): void {
    this.contract.set(contract);
    this.form = { ...contract };
    this.items.set((contract.Items ?? []).map(toItemDraft));
  }

  private itemsChanged(): boolean {
    const saved = (this.contract()?.Items ?? []).map(toItemDraft);
    const current = withoutBlankItems(this.items()).map((item) => ({ ...toItemDraft(item), Description: item.Description.trim() }));
    return JSON.stringify(saved) !== JSON.stringify(current);
  }

  /** Enregistrer : si les lignes changent et qu'une facture non payée existe, on demande quoi en faire. */
  save(): void {
    const invoice = this.activeInvoice();
    if (invoice && this.itemsChanged() && invoice.Status !== "paid") {
      this.question.set({
        invoice,
        mode: invoice.Status === "draft" ? "update" : "replace",
        newTotal: computeTotals(withoutBlankItems(this.items())).total
      });
      this.questionDialog()?.nativeElement.showModal();
      return;
    }
    void this.persist("none");
  }

  answer(action: ContractInvoiceAction | null): void {
    this.questionDialog()?.nativeElement.close();
    this.question.set(null);
    if (action) void this.persist(action);
  }

  private async persist(invoiceAction: ContractInvoiceAction): Promise<void> {
    const paidInvoice = this.activeInvoice()?.Status === "paid" && this.itemsChanged() ? this.activeInvoice() : null;
    this.saving.set(true);
    this.error.set(null);
    this.info.set(null);
    try {
      const updated = await this.contractService.updateContract(this.contractId, {
        RouteId: this.form.RouteId ? Number(this.form.RouteId) : null,
        StartDate: this.form.StartDate,
        EndDate: this.form.EndDate,
        Status: this.form.Status,
        Notes: this.form.Notes,
        Items: withoutBlankItems(this.items()),
        invoiceAction
      });
      this.applyContract(updated);
      await this.reloadInvoices();
      this.info.set(this.syncMessage(updated, paidInvoice));
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  private syncMessage(updated: Contract, paidInvoice: Invoice | null): string {
    const number = updated.InvoiceSync?.invoiceNumber;
    switch (updated.InvoiceSync?.action) {
      case "updated":
        return "Contrat enregistré. Montant à payer mis à jour.";
      case "replaced":
        return `Contrat enregistré. Montant corrigé émis (N° ${number}), à renvoyer au client. L'ancien est annulé.`;
      case "created":
        return `Contrat enregistré. Montant à payer établi (N° ${number}).`;
      case "cancelled":
        return "Contrat annulé. Le montant à payer (non envoyé) a été annulé.";
      default:
        return paidInvoice
          ? "Contrat enregistré. Le contrat est déjà payé : le montant payé n'a pas été modifié."
          : "Contrat enregistré.";
    }
  }

  private async reloadInvoices(): Promise<void> {
    this.invoices.set(await this.invoiceService.getInvoices({ contractId: this.contractId }));
    this.dueDate = "";
  }

  private async invoiceAction(run: () => Promise<unknown>, message: string): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    this.info.set(null);
    try {
      await run();
      await this.reloadInvoices();
      this.info.set(message);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  generateInvoice(): Promise<void> {
    return this.invoiceAction(() => this.invoiceService.createFromContract(this.contractId), "Montant à payer établi à partir des éléments du contrat.");
  }

  /** Envoyé autrement (remis en main propre, poste...) : aucun courriel ne part. */
  markSent(invoice: Invoice): Promise<void> {
    if (!confirm("Marquer le contrat comme envoyé au client sans l'envoyer par courriel ? Le montant sera figé.")) return Promise.resolve();
    return this.invoiceAction(
      () => this.invoiceService.markSent(invoice.Id, this.dueDate || undefined),
      "Contrat marqué envoyé au client. Le montant est maintenant figé."
    );
  }

  /** Ouvre l'aperçu du contrat tel qu'il sera envoyé (vrai PDF). */
  async openSendDialog(): Promise<void> {
    this.error.set(null);
    this.previewPdf.set(null);
    this.sendDialogOpen.set(true);
    this.sendDialog()?.nativeElement.showModal();
    try {
      this.previewPdf.set(await this.contractService.getDocument(this.contractId, this.dueDate || undefined));
    } catch (e) {
      this.closeSendDialog();
      this.error.set((e as Error).message);
    }
  }

  closeSendDialog(): void {
    this.sendDialog()?.nativeElement.close();
    this.sendDialogOpen.set(false);
  }

  async sendByEmail(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    this.info.set(null);
    try {
      const result = await this.contractService.sendToClient(this.contractId, this.dueDate || undefined);
      this.closeSendDialog();
      await this.reloadInvoices();
      this.info.set(
        `Contrat envoyé par courriel à ${result.sentTo}.` +
          (result.dryRun ? " Mode test (SMTP non configuré ou CONTRACT_EMAIL_DRY_RUN=true) : le courriel a seulement été journalisé, rien n'est parti." : "")
      );
    } catch (e) {
      this.error.set((e as Error).message);
      this.closeSendDialog();
    } finally {
      this.saving.set(false);
    }
  }

  async download(invoice: Invoice): Promise<void> {
    this.error.set(null);
    try {
      const pdf = this.previewPdf() && this.sendDialogOpen()
        ? this.previewPdf()!
        : await this.contractService.getDocument(this.contractId, this.dueDate || undefined);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(pdf);
      link.download = `Contrat-${this.contract()?.Reference}-${invoice.InvoiceNumber}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  markPaid(invoice: Invoice): Promise<void> {
    if (!confirm(`Marquer le contrat comme payé (${formatMoney(invoice.Amount)}) ?`)) return Promise.resolve();
    return this.invoiceAction(() => this.invoiceService.markPaid(invoice.Id), "Contrat payé.");
  }

  isIssued(invoice: Invoice): boolean {
    return ISSUED_STATUSES.includes(invoice.Status);
  }
}
