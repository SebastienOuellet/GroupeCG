import { inject, Injectable } from "@angular/core";
import { ApiService } from "../api.service";
import { Client, ServiceAddress } from "../models/domain.model";

/** Payload de création : l'adresse optionnelle est créée dans la même transaction. */
export type CreateClientPayload = Partial<Client> & { ServiceAddress?: Partial<ServiceAddress> };

@Injectable({
  providedIn: "root"
})
export class ClientService {
  private readonly api = inject(ApiService);

  getClients(search?: string): Promise<Client[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    return this.api.get<Client[]>(`client${query}`);
  }

  getClient(id: number): Promise<Client> {
    return this.api.get<Client>(`client/${id}`);
  }

  createClient(client: CreateClientPayload): Promise<Client> {
    return this.api.post<Client>("client", client);
  }

  updateClient(id: number, client: Partial<Client>): Promise<Client> {
    return this.api.put<Client>(`client/${id}`, client);
  }

  deactivateClient(id: number): Promise<void> {
    return this.api.delete<void>(`client/${id}`);
  }
}
