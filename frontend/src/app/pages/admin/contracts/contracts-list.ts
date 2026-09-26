import { Component, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { ContractService } from "../../../core/services/contract.service";
import { ClientService } from "../../../core/services/client.service";
import { RouteService } from "../../../core/services/route.service";
import { ServiceAddressService } from "../../../core/services/service-address.service";
import { Client, Contract, RouteModel, ServiceAddress } from "../../../core/models/domain.model";
import { ClientQuickCreate, QuickCreateResult } from "../clients/client-quick-create/client-quick-create";

type QuickCreateMode = "client" | "address";

@Component({
  selector: "app-contracts-list",
  imports: [FormsModule, ClientQuickCreate],
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

  filters = { seasonYear: "", status: "", routeId: "" };
  form: Partial<Contract> & { ClientId?: number } = {};

  readonly currentYear = new Date().getFullYear();
  readonly seasonYears = [this.currentYear - 1, this.currentYear, this.currentYear + 1];

  async ngOnInit(): Promise<void> {
    await Promise.all([this.load(), this.loadRefs()]);
  }

  async loadRefs(): Promise<void> {
    try {
      const [routes, clients] = await Promise.all([
        this.routeService.getRoutes(),
        this.clientService.getClients()
      ]);
      this.routes.set(routes);
      this.clients.set(clients);
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

  openQuickCreate(mode: QuickCreateMode): void {
    if (mode === "address" && !this.selectedClient()) return;
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
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.contractService.createContract({
        ...this.form,
        ClientId: Number(this.form.ClientId),
        ServiceAddressId: Number(this.form.ServiceAddressId),
        RouteId: this.form.RouteId ? Number(this.form.RouteId) : null,
        SeasonStartYear: Number(this.form.SeasonStartYear)
      });
      this.showForm.set(false);
      await this.load();
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

  clientDisplay(client: Client): string {
    const person = [client.FirstName, client.LastName].filter(Boolean).join(" ");
    return `#${client.ClientNumber} — ${client.CompanyName || person || "?"}`;
  }
}
