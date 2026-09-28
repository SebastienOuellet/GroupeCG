import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { ClientService } from "../../../core/services/client.service";
import { ServiceAddressService } from "../../../core/services/service-address.service";
import { TenantService } from "../../../core/services/tenant.service";
import { contactValue, NoticeChannel, suppressionNote, suppressionOf } from "../../../core/models/consent";
import { contactErrors, emailError, phoneError } from "../../../core/utils/contact-validation";
import { ContactForm } from "../../../shared/contact-form/contact-form";
import { NoticeStatus } from "../../../shared/notice-status/notice-status";
import { Client, ContractStatus, ServiceAddress, Tenant } from "../../../core/models/domain.model";
import { GeocodedPlace, GoogleMapsService } from "../../../core/services/google-maps.service";
import { AddressFields } from "../../../shared/address-fields/address-fields";
import { StreetView } from "../../../shared/street-view/street-view";
import { SurfaceBadge } from "../../../shared/surface-badge/surface-badge";
import { InvoiceService } from "../../../core/services/invoice.service";
import { CONTRACT_PAYMENT_LABELS, Invoice, INVOICE_STATUS_LABELS } from "../../../core/models/invoice.model";
import { contractAmount, formatMoney } from "../../../core/models/billing";
import { Contract } from "../../../core/models/domain.model";

/** Contrats qui utilisent encore l'adresse (miroir du backend) : bloquent la désactivation. */
const BLOCKING_CONTRACT_STATUSES: ContractStatus[] = ["draft", "active"];
const LOCATION_FIELDS = ["CivicNumber", "Street", "City", "PostalCode"] as const;

@Component({
  selector: "app-client-detail",
  imports: [FormsModule, RouterLink, AddressFields, StreetView, SurfaceBadge, ContactForm, NoticeStatus],
  styleUrl: "./client-detail.scss",
  templateUrl: "./client-detail.html"
})
export class ClientDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clientService = inject(ClientService);
  private readonly addressService = inject(ServiceAddressService);
  private readonly tenantService = inject(TenantService);
  private readonly invoiceService = inject(InvoiceService);

  readonly client = signal<Client | null>(null);
  readonly tenantsByAddress = signal<Record<number, Tenant[]>>({});
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly showAddressForm = signal(false);
  /** Formulaire de locataire ouvert : ajout (tenant sans Id) ou modification. */
  readonly tenantEditor = signal<{ addressId: number; tenant: Partial<Tenant> } | null>(null);
  /** Adresses dont la liste de locataires est dépliée (fermée par défaut : un immeuble peut en avoir des dizaines). */
  readonly openTenantAddresses = signal<ReadonlySet<number>>(new Set());
  readonly channels: NoticeChannel[] = ["sms", "email"];
  readonly emailError = emailError;
  readonly phoneError = phoneError;
  /** Une seule vue Street View ouverte à la fois : chaque chargement est facturé par Google. */
  readonly streetViewAddressId = signal<number | null>(null);
  readonly editingAddressId = signal<number | null>(null);
  readonly mapsEnabled = inject(GoogleMapsService).isEnabled;

  readonly invoices = signal<Invoice[]>([]);
  /** Le contrat fait office de facture : ici on ne liste que les factures de service. */
  readonly serviceInvoices = computed(() => this.invoices().filter((invoice) => invoice.Type === "service"));
  readonly invoiceStatusLabels = INVOICE_STATUS_LABELS;
  readonly paymentLabels = CONTRACT_PAYMENT_LABELS;
  readonly formatMoney = formatMoney;

  clientForm: Partial<Client> = {};
  addressForm: Partial<ServiceAddress> = {};
  editForm: Partial<ServiceAddress> = {};

  private clientId!: number;

  /** Paiement en cours du contrat (le plus récent non annulé). */
  contractPayment(contract: Contract): Invoice | null {
    return this.invoices()
      .filter((invoice) => invoice.Type === "contract" && invoice.ContractId === contract.Id && invoice.Status !== "cancelled")
      .sort((a, b) => b.Id - a.Id)[0] ?? null;
  }

  contractTotal(contract: Contract): number {
    return contractAmount(contract.Price, this.contractPayment(contract)?.Amount);
  }

  async ngOnInit(): Promise<void> {
    this.clientId = Number(this.route.snapshot.paramMap.get("id"));
    await this.load();
  }

  async load(): Promise<void> {
    this.error.set(null);
    try {
      const client = await this.clientService.getClient(this.clientId);
      this.client.set(client);
      this.clientForm = { ...client };

      const tenantsMap: Record<number, Tenant[]> = {};
      for (const address of client.ServiceAddresses ?? []) {
        tenantsMap[address.Id] = await this.tenantService.getTenants(address.Id);
      }
      this.tenantsByAddress.set(tenantsMap);
      this.invoices.set(await this.invoiceService.getInvoices({ clientId: this.clientId }));
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  async saveClient(): Promise<void> {
    const invalid = contactErrors(this.clientForm);
    if (invalid) {
      this.error.set(invalid);
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.clientService.updateClient(this.clientId, this.clientForm);
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  async deactivateClient(): Promise<void> {
    if (!confirm("Désactiver ce client ?")) return;
    try {
      await this.clientService.deactivateClient(this.clientId);
      await this.router.navigate(["/clients"]);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  openAddressForm(): void {
    this.addressForm = { ClientId: this.clientId };
    this.showAddressForm.set(true);
  }

  async saveAddress(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.addressService.createAddress(this.addressForm);
      this.showAddressForm.set(false);
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  openAddressEdit(address: ServiceAddress): void {
    this.editForm = { ...address };
    this.streetViewAddressId.set(null);
    this.tenantEditor.set(null);
    this.editingAddressId.set(address.Id);
  }

  async saveAddressEdit(address: ServiceAddress): Promise<void> {
    const { CivicNumber, Street, City, PostalCode, PlaceId, Latitude, Longitude, DrivewaySurface, DrivewaySize, Notes } = this.editForm;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.addressService.updateAddress(address.Id, {
        CivicNumber,
        Street,
        City,
        PostalCode,
        PlaceId: PlaceId ?? null,
        Latitude: Latitude ?? null,
        Longitude: Longitude ?? null,
        DrivewaySurface: DrivewaySurface ?? null,
        DrivewaySize: DrivewaySize ?? null,
        Notes: Notes ?? null
      });
      this.editingAddressId.set(null);
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  async deactivateAddress(address: ServiceAddress): Promise<void> {
    if (!confirm(`Désactiver l'adresse ${this.addressLabel(address)} ?`)) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.addressService.deactivateAddress(address.Id);
      this.editingAddressId.set(null);
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  blockingContractCount(addressId: number): number {
    return (this.client()?.Contracts ?? []).filter(
      (c) => c.ServiceAddressId === addressId && BLOCKING_CONTRACT_STATUSES.includes(c.Status)
    ).length;
  }

  /** Vrai si l'emplacement change (pas seulement les notes ou le revêtement). */
  locationChanged(address: ServiceAddress): boolean {
    const normalize = (v: unknown) => String(v ?? "").replace(/\s/g, "").toUpperCase();
    return LOCATION_FIELDS.some((f) => normalize(this.editForm[f]) !== normalize(address[f]));
  }

  toggleStreetView(addressId: number): void {
    this.streetViewAddressId.update((current) => (current === addressId ? null : addressId));
  }

  /** Adresse créée avant l'autocomplete : on mémorise les coordonnées trouvées pour ne géocoder qu'une fois. */
  async saveCoordinates(address: ServiceAddress, location: GeocodedPlace): Promise<void> {
    try {
      // Pas de mutation locale : elle relancerait la vue (2e chargement facturé). Le prochain load() les aura.
      await this.addressService.updateAddress(address.Id, { Latitude: location.lat, Longitude: location.lng, PlaceId: location.placeId });
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  addressLabel(address: ServiceAddress): string {
    return `${address.CivicNumber} ${address.Street}, ${address.City} ${address.PostalCode}`;
  }

  isTenantsOpen(addressId: number): boolean {
    return this.openTenantAddresses().has(addressId);
  }

  toggleTenants(addressId: number, open?: boolean): void {
    this.openTenantAddresses.update((current) => {
      const next = new Set(current);
      const shouldOpen = open ?? !next.has(addressId);
      if (shouldOpen) next.add(addressId);
      else next.delete(addressId);
      return next;
    });
  }

  unsubscribedCount(addressId: number): number {
    return (this.tenantsByAddress()[addressId] ?? []).filter((tenant) => tenant.Suppressions?.sms || tenant.Suppressions?.email).length;
  }

  /** Contrats en cours à cette adresse (actif, ou brouillon après un roulement de saison), saison la plus récente d'abord. */
  addressContracts(address: ServiceAddress): Contract[] {
    return (this.client()?.Contracts ?? [])
      .filter((contract) => contract.ServiceAddressId === address.Id && (contract.Status === "active" || contract.Status === "draft"))
      .sort((a, b) => b.SeasonStartYear - a.SeasonStartYear);
  }

  contractStatusLabel(contract: Contract): string {
    return contract.Status === "active" ? "Actif" : "Brouillon";
  }

  openTenantForm(addressId: number): void {
    this.tenantEditor.set({ addressId, tenant: { ServiceAddressId: addressId, SmsConsent: true, EmailConsent: true } });
    this.toggleTenants(addressId, true);
  }

  editTenant(tenant: Tenant): void {
    this.tenantEditor.set({ addressId: tenant.ServiceAddressId, tenant: { ...tenant } });
  }

  async saveTenant(fields: Partial<Tenant>): Promise<void> {
    const editor = this.tenantEditor();
    if (!editor) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      if (editor.tenant.Id) {
        await this.tenantService.updateTenant(editor.tenant.Id, fields);
      } else {
        await this.tenantService.createTenant({ ...fields, ServiceAddressId: editor.addressId });
      }
      this.tenantEditor.set(null);
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  /* --- Client lui-même : canal désinscrit verrouillé --- */
  clientLocked(channel: NoticeChannel): boolean {
    return !!suppressionOf(this.client() ?? {}, channel);
  }

  clientHasContact(channel: NoticeChannel): boolean {
    return !!contactValue(this.clientForm, channel);
  }

  clientNote(channel: NoticeChannel): string | null {
    const suppression = suppressionOf(this.client() ?? {}, channel);
    return suppression ? suppressionNote(channel, suppression) : null;
  }

  async removeTenant(tenant: Tenant): Promise<void> {
    if (!confirm("Retirer ce locataire ?")) return;
    try {
      await this.tenantService.deactivateTenant(tenant.Id);
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  tenantName(tenant: Tenant): string {
    return [tenant.FirstName, tenant.LastName].filter(Boolean).join(" ") || "—";
  }
}
