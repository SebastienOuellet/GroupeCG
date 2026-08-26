import { Component, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { ClientService } from "../../../core/services/client.service";
import { ServiceAddressService } from "../../../core/services/service-address.service";
import { TenantService } from "../../../core/services/tenant.service";
import { Client, ServiceAddress, Tenant } from "../../../core/models/domain.model";

@Component({
  selector: "app-client-detail",
  imports: [FormsModule, RouterLink],
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

  clientForm: Partial<Client> = {};
  addressForm: Partial<ServiceAddress> = {};
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
