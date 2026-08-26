import { Component, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { ClientService } from "../../../core/services/client.service";
import { Client } from "../../../core/models/domain.model";

@Component({
  selector: "app-clients-list",
  imports: [FormsModule],
  templateUrl: "./clients-list.html"
})
export class ClientsList implements OnInit {
  private readonly clientService = inject(ClientService);
  private readonly router = inject(Router);

  readonly clients = signal<Client[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly showForm = signal(false);
  readonly saving = signal(false);

  search = "";
  form: Partial<Client> = {};

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.clients.set(await this.clientService.getClients(this.search || undefined));
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  openForm(): void {
    this.form = { SmsConsent: true, EmailConsent: true };
    this.showForm.set(true);
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      const created = await this.clientService.createClient(this.form);
      this.showForm.set(false);
      await this.router.navigate(["/clients", created.Id]);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  open(client: Client): void {
    this.router.navigate(["/clients", client.Id]);
  }

  displayName(client: Client): string {
    const person = [client.FirstName, client.LastName].filter(Boolean).join(" ");
    return client.CompanyName ? `${client.CompanyName}${person ? " (" + person + ")" : ""}` : person || "—";
  }
}
