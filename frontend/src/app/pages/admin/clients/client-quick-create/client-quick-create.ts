import { AfterViewInit, Component, OnInit, ElementRef, inject, input, output, signal, viewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ClientService } from "../../../../core/services/client.service";
import { ServiceAddressService } from "../../../../core/services/service-address.service";
import { Client, ServiceAddress } from "../../../../core/models/domain.model";
import { AddressFields } from "../../../../shared/address-fields/address-fields";

export interface QuickCreateResult {
  client: Client;
  address: ServiceAddress;
}

/**
 * Modale de création rapide utilisée depuis le formulaire de contrat.
 * - Sans `client` : crée un nouveau client + sa première adresse de service (une seule
 *   transaction côté backend).
 * - Avec `client` : ajoute seulement une adresse de service à ce client existant.
 * Le parent l'affiche avec un @if ; la modale s'ouvre d'elle-même et émet `closed`
 * (annulation) ou `created` (succès).
 */
@Component({
  selector: "app-client-quick-create",
  imports: [FormsModule, AddressFields],
  templateUrl: "./client-quick-create.html",
  styleUrl: "./client-quick-create.scss"
})
export class ClientQuickCreate implements OnInit, AfterViewInit {
  private readonly clientService = inject(ClientService);
  private readonly addressService = inject(ServiceAddressService);

  readonly client = input<Client | null>(null);
  /** Texte tapé dans la recherche : « Jean Tremblay » → Prénom « Jean », Nom « Tremblay ». */
  readonly prefillName = input("");
  readonly created = output<QuickCreateResult>();
  readonly closed = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  private result: QuickCreateResult | null = null;

  clientForm: Partial<Client> = { SmsConsent: true, EmailConsent: true };
  addressForm: Partial<ServiceAddress> = {};

  ngOnInit(): void {
    const text = this.prefillName().trim();
    // Une recherche par numéro de client ou de téléphone n'est pas un nom.
    if (!text || /^[\d\s+()#-]+$/.test(text)) return;
    const [first, ...rest] = text.split(/\s+/);
    this.clientForm.FirstName = first;
    if (rest.length) this.clientForm.LastName = rest.join(" ");
  }

  ngAfterViewInit(): void {
    this.dialog().nativeElement.showModal();
  }

  get isAddressOnly(): boolean {
    return this.client() !== null;
  }

  clientName(client: Client): string {
    const person = [client.FirstName, client.LastName].filter(Boolean).join(" ");
    return `#${client.ClientNumber} — ${client.CompanyName || person || "?"}`;
  }

  /** Bouton Annuler / ×. */
  cancel(): void {
    if (this.saving()) return;
    this.dialog().nativeElement.close();
  }

  /** Échap natif : bloqué pendant l'enregistrement. */
  onCancelEvent(event: Event): void {
    if (this.saving()) event.preventDefault();
  }

  /**
   * Point de sortie unique : l'événement `close` du <dialog> est émis quelle que soit la
   * façon dont il se ferme (Échap, bouton, fermeture forcée par Chrome/CloseWatcher).
   */
  onClose(): void {
    if (this.result) {
      this.created.emit(this.result);
    } else {
      this.closed.emit();
    }
  }

  async save(): Promise<void> {
    this.error.set(null);

    if (!this.isAddressOnly) {
      const { FirstName, LastName, CompanyName } = this.clientForm;
      if (![FirstName, LastName, CompanyName].some((value) => value?.trim())) {
        this.error.set("Indiquez au moins un nom ou une entreprise.");
        return;
      }
    }

    this.saving.set(true);
    try {
      this.result = this.isAddressOnly ? await this.createAddress() : await this.createClient();
      this.saving.set(false);
      this.dialog().nativeElement.close();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  private async createClient(): Promise<QuickCreateResult> {
    const client = await this.clientService.createClient({
      ...this.clientForm,
      ServiceAddress: this.addressForm
    });
    const address = client.ServiceAddresses?.[0];
    if (!address) {
      throw new Error("Le client a été créé mais l'adresse est introuvable.");
    }
    return { client, address };
  }

  private async createAddress(): Promise<QuickCreateResult> {
    const client = this.client()!;
    const address = await this.addressService.createAddress({ ...this.addressForm, ClientId: client.Id });
    return { client, address };
  }
}
