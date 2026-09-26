import { Component, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { ClientService } from "../../../core/services/client.service";
import { ContractService } from "../../../core/services/contract.service";
import { InvoiceService } from "../../../core/services/invoice.service";
import { Client, ContractItem } from "../../../core/models/domain.model";
import { ClientPicker } from "../clients/client-picker/client-picker";
import { withoutBlankItems } from "../../../core/models/billing";
import { ContractItemsEditor } from "../../../shared/contract-items-editor/contract-items-editor";

/**
 * Facture de service : travaux ponctuels hors contrat (toiture, déglaçage,
 * passage supplémentaire...). `?client=<id>` présélectionne le client.
 */
@Component({
  selector: "app-service-invoice-new",
  imports: [FormsModule, RouterLink, ClientPicker, ContractItemsEditor],
  templateUrl: "./service-invoice-new.html"
})
export class ServiceInvoiceNew implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clientService = inject(ClientService);
  private readonly contractService = inject(ContractService);
  private readonly invoiceService = inject(InvoiceService);

  readonly clients = signal<Client[]>([]);
  readonly itemSuggestions = signal<string[]>([]);
  readonly items = signal<ContractItem[]>([{ Description: "", Quantity: 1, UnitPrice: null }]);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);

  clientId: number | undefined;
  dueDate = "";
  notes = "";

  async ngOnInit(): Promise<void> {
    const preselected = Number(this.route.snapshot.queryParamMap.get("client"));
    try {
      const [clients, suggestions] = await Promise.all([
        this.clientService.getClients(),
        this.contractService.getItemSuggestions()
      ]);
      this.clients.set(clients);
      this.itemSuggestions.set(suggestions);
      if (preselected && clients.some((client) => client.Id === preselected)) {
        this.clientId = preselected;
      }
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  async save(): Promise<void> {
    if (!this.clientId) {
      this.error.set("Choisissez un client.");
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const invoice = await this.invoiceService.createServiceInvoice({
        clientId: Number(this.clientId),
        items: withoutBlankItems(this.items()),
        notes: this.notes || undefined,
        dueDate: this.dueDate || undefined
      });
      this.router.navigate(["/factures", invoice.Id]);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
