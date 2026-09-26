import { Component, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { ContractService } from "../../../core/services/contract.service";
import { ClientService } from "../../../core/services/client.service";
import { RouteService } from "../../../core/services/route.service";
import { ServiceAddressService } from "../../../core/services/service-address.service";
import { Client, Contract, ContractItem, RouteModel, ServiceAddress } from "../../../core/models/domain.model";
import { contractAmount, formatMoney, withoutBlankItems } from "../../../core/models/billing";
import { ContractItemsEditor } from "../../../shared/contract-items-editor/contract-items-editor";
import { ClientQuickCreate, QuickCreateResult } from "../clients/client-quick-create/client-quick-create";
import { ClientPicker } from "../clients/client-picker/client-picker";

type QuickCreateMode = "client" | "address";

@Component({
  selector: "app-contracts-list",
  imports: [FormsModule, ClientQuickCreate, ClientPicker, ContractItemsEditor],
  templateUrl: "./contracts-list.html"
})
export class ContractsList implements OnInit {
  private readonly contractService = inject(ContractService);
  private readonly clientService = inject(ClientService);
  private readonly routeService = inject(RouteService);
  private readonly addressService = inject(ServiceAddressService);
  private readonly router = inject(Router);

  readonly contracts = signal<Contract[]>([]);
  readonly routes = signal<RouteModel[]>([]);
  readonly clients = signal<Client[]>([]);
  readonly clientAddresses = signal<ServiceAddress[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);
  readonly showForm = signal(false);
  readonly saving = signal(false);
  readonly quickCreate = signal<QuickCreateMode | null>(null);
  readonly quickCreatePrefill = signal("");
  readonly itemSuggestions = signal<string[]>([]);
  readonly items = signal<ContractItem[]>([]);
  readonly formatMoney = formatMoney;

  filters = { seasonYear: "", status: "", routeId: "" };
  form: Partial<Contract> & { ClientId?: number } = {};

  readonly currentYear = new Date().getFullYear();
  readonly seasonYears = [this.currentYear - 1, this.currentYear, this.currentYear + 1];

  async ngOnInit(): Promise<void> {
    await Promise.all([this.load(), this.loadRefs()]);
  }

  async loadRefs(): Promise<void> {
    try {
      const [routes, clients, suggestions] = await Promise.all([
        this.routeService.getRoutes(),
        this.clientService.getClients(),
        this.contractService.getItemSuggestions()
      ]);
      this.routes.set(routes);
      this.clients.set(clients);
      this.itemSuggestions.set(suggestions);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.contracts.set(
        await this.contractService.getContracts({
          seasonYear: this.filters.seasonYear ? Number(this.filters.seasonYear) : undefined,
          status: this.filters.status || undefined,
          routeId: this.filters.routeId ? Number(this.filters.routeId) : undefined
        })
      );
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  openForm(): void {
    this.form = {
      SeasonStartYear: this.currentYear,
      StartDate: `${this.currentYear}-11-01`,
      EndDate: `${this.currentYear + 1}-04-30`,
      RouteId: null,
      Status: "active"
    };
    this.items.set([{ Description: this.itemSuggestions()[0] ?? "Déneigement saisonnier", Quantity: 1, UnitPrice: null }]);
    this.clientAddresses.set([]);
    this.showForm.set(true);
  }

  async onClientChange(): Promise<void> {
    this.form.ServiceAddressId = undefined;
    if (!this.form.ClientId) {
      this.clientAddresses.set([]);
      return;
    }
    this.clientAddresses.set(await this.addressService.getAddresses(Number(this.form.ClientId)));
  }

  selectedClient(): Client | null {
    return this.clients().find((client) => client.Id === Number(this.form.ClientId)) ?? null;
  }

  /** `prefill` : texte tapé dans la recherche client, repris comme nom du nouveau client. */
  openQuickCreate(mode: QuickCreateMode, prefill = ""): void {
    if (mode === "address" && !this.selectedClient()) return;
    this.quickCreatePrefill.set(prefill);
    this.quickCreate.set(mode);
  }

  /** Sélectionne automatiquement le client et/ou l'adresse fraîchement créés. */
  onQuickCreated({ client, address }: QuickCreateResult): void {
    if (!this.clients().some((existing) => existing.Id === client.Id)) {
      this.clients.update((list) => [...list, client].sort((a, b) => a.ClientNumber - b.ClientNumber));
      this.form.ClientId = client.Id;
      this.clientAddresses.set([address]);
    } else {
      this.clientAddresses.update((list) => [...list, address]);
    }
    this.form.ServiceAddressId = address.Id;
    this.quickCreate.set(null);
  }

  async save(): Promise<void> {
    if (!this.form.ClientId) {
      this.error.set("Choisissez un client.");
      return;
    }
    const { Price, ...fields } = this.form;
    this.saving.set(true);
    this.error.set(null);
    try {
      const created = await this.contractService.createContract({
        ...fields,
        ClientId: Number(this.form.ClientId),
        ServiceAddressId: Number(this.form.ServiceAddressId),
        RouteId: this.form.RouteId ? Number(this.form.RouteId) : null,
        SeasonStartYear: Number(this.form.SeasonStartYear),
        Items: withoutBlankItems(this.items())
      });
      this.showForm.set(false);
      // Direction la fiche : la facture brouillon y est prête à envoyer.
      this.router.navigate(["/contrats", created.Id]);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  async rollover(): Promise<void> {
    const fromYear = this.filters.seasonYear ? Number(this.filters.seasonYear) : this.currentYear;
    if (!confirm(`Générer les contrats de la saison ${fromYear + 1}-${fromYear + 2} à partir des contrats actifs de ${fromYear}-${fromYear + 1} ?`)) {
      return;
    }
    this.error.set(null);
    this.info.set(null);
    try {
      const result = await this.contractService.rolloverSeason(fromYear);
      this.info.set(`Roulement terminé : ${result.createdCount} contrat(s) créé(s), ${result.skipped.length} ignoré(s).`);
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  /** Montant du paiement en cours (figé) ; à défaut, prix des éléments + taxes. */
  contractTotal(contract: Contract): number {
    const payment = [...(contract.Invoices ?? [])].sort((a, b) => b.Id - a.Id)[0];
    return contractAmount(contract.Price, payment?.Amount);
  }

  open(contract: Contract): void {
    this.router.navigate(["/contrats", contract.Id]);
  }

  clientLabel(contract: Contract): string {
    const client = contract.Client;
    if (!client) return "—";
    const person = [client.FirstName, client.LastName].filter(Boolean).join(" ");
    return client.CompanyName || person || `#${client.ClientNumber}`;
  }

  addressLabel(contract: Contract): string {
    const address = contract.ServiceAddress;
    return address ? `${address.CivicNumber} ${address.Street}, ${address.City}` : "—";
  }
}
