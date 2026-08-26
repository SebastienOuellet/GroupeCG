import { Component, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouteService } from "../../../core/services/route.service";
import { Contract, RouteModel } from "../../../core/models/domain.model";

@Component({
  selector: "app-routes-list",
  imports: [FormsModule],
  templateUrl: "./routes-list.html"
})
export class RoutesList implements OnInit {
  private readonly routeService = inject(RouteService);

  readonly routes = signal<RouteModel[]>([]);
  readonly selectedRoute = signal<RouteModel | null>(null);
  readonly routeContracts = signal<Contract[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly showForm = signal(false);
  readonly saving = signal(false);

  form: Partial<RouteModel> = {};

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.routes.set(await this.routeService.getRoutes());
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  async select(route: RouteModel): Promise<void> {
    if (this.selectedRoute()?.Id === route.Id) {
      this.selectedRoute.set(null);
      return;
    }
    this.selectedRoute.set(route);
    try {
      this.routeContracts.set(await this.routeService.getRouteContracts(route.Id));
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  openForm(route?: RouteModel): void {
    this.form = route ? { ...route } : { SortOrder: this.routes().length };
    this.showForm.set(true);
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      if (this.form.Id) {
        await this.routeService.updateRoute(this.form.Id, this.form);
      } else {
        await this.routeService.createRoute(this.form);
      }
      this.showForm.set(false);
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  async deactivate(route: RouteModel): Promise<void> {
    if (!confirm(`Désactiver la route « ${route.Name} » ?`)) return;
    try {
      await this.routeService.deactivateRoute(route.Id);
      this.selectedRoute.set(null);
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    }
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
