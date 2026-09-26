import { Component, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { ClientService } from "../../../core/services/client.service";
import { ServiceAddressService } from "../../../core/services/service-address.service";
import { TenantService } from "../../../core/services/tenant.service";
import { Client, ContractStatus, ServiceAddress, Tenant } from "../../../core/models/domain.model";
import { GoogleMapsService, LatLng } from "../../../core/services/google-maps.service";
import { AddressFields } from "../../../shared/address-fields/address-fields";
import { StreetView } from "../../../shared/street-view/street-view";
import { SurfaceBadge } from "../../../shared/surface-badge/surface-badge";

/** Contrats qui utilisent encore l'adresse (miroir du backend) : bloquent la désactivation. */
const BLOCKING_CONTRACT_STATUSES: ContractStatus[] = ["draft", "active"];
const LOCATION_FIELDS = ["CivicNumber", "Street", "City", "PostalCode"] as const;

@Component({
  selector: "app-client-detail",
  imports: [FormsModule, RouterLink, AddressFields, StreetView, SurfaceBadge],
  styleUrl: "./client-detail.scss",
  templateUrl: "./client-detail.html"
})
export class ClientDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clientService = inject(ClientService);
  private readonly addressService = inject(ServiceAddressService);
  private readonly tenantService = inject(TenantService);

  readonly client = signal<Client | null>(null);
  readonly tenantsByAddress = signal<Record<number, Tenant[]>>({});
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly showAddressForm = signal(false);
  readonly tenantFormAddressId = signal<number | null>(null);
  /** Une seule vue Street View ouverte à la fois : chaque chargement est facturé par Google. */
  readonly streetViewAddressId = signal<number | null>(null);
  readonly editingAddressId = signal<number | null>(null);
  readonly mapsEnabled = inject(GoogleMapsService).isEnabled;

  clientForm: Partial<Client> = {};
  addressForm: Partial<ServiceAddress> = {};
  editForm: Partial<ServiceAddress> = {};
  tenantForm: Partial<Tenant> = {};

  private clientId!: number;

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
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  async saveClient(): Promise<void> {
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
    this.tenantFormAddressId.set(null);
    this.editingAddressId.set(address.Id);
  }

  async saveAddressEdit(address: ServiceAddress): Promise<void> {
    const { CivicNumber, Street, City, PostalCode, Latitude, Longitude, DrivewaySurface, Notes } = this.editForm;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.addressService.updateAddress(address.Id, {
        CivicNumber,
        Street,
        City,
        PostalCode,
        Latitude: Latitude ?? null,
        Longitude: Longitude ?? null,
        DrivewaySurface: DrivewaySurface ?? null,
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
  async saveCoordinates(address: ServiceAddress, location: LatLng): Promise<void> {
    try {
      // Pas de mutation locale : elle relancerait la vue (2e chargement facturé). Le prochain load() les aura.
      await this.addressService.updateAddress(address.Id, { Latitude: location.lat, Longitude: location.lng });
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  addressLabel(address: ServiceAddress): string {
    return `${address.CivicNumber} ${address.Street}, ${address.City} ${address.PostalCode}`;
  }

  openTenantForm(addressId: number): void {
    this.tenantForm = { ServiceAddressId: addressId, SmsConsent: true, EmailConsent: true };
    this.tenantFormAddressId.set(addressId);
  }

  async saveTenant(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.tenantService.createTenant(this.tenantForm);
      this.tenantFormAddressId.set(null);
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
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
