import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { RouteService } from "../../../core/services/route.service";
import { RouteModel } from "../../../core/models/domain.model";
import { UserService } from "../../../core/user.service";
import { ManagedUser, OPERATOR_CAPABLE_ROLES } from "../../../core/models/user.model";

@Component({
  selector: "app-routes-list",
  imports: [FormsModule],
  templateUrl: "./routes-list.html"
})
export class RoutesList implements OnInit {
  private readonly routeService = inject(RouteService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);

  readonly routes = signal<RouteModel[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly showForm = signal(false);
  readonly saving = signal(false);
  readonly users = signal<ManagedUser[]>([]);
  readonly operators = computed(() => this.users().filter((u) => u.Role === "operator"));
  readonly admins = computed(() => this.users().filter((u) => u.Role === "admin"));

  form: Partial<RouteModel> = {};

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [routes, users] = await Promise.all([this.routeService.getRoutes(), this.userService.getUsers()]);
      this.routes.set(routes);
      this.users.set(users.filter((u) => OPERATOR_CAPABLE_ROLES.includes(u.Role)));
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  /** Page de la route : ordre de passage, carte, point d'attache. */
  open(route: RouteModel): void {
    this.router.navigate(["/routes", route.Id]);
  }

  openForm(route?: RouteModel): void {
    this.form = route ? { ...route } : { SortOrder: this.routes().length, OperatorUserId: null };
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
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  userLabel(user: ManagedUser): string {
    return user.Name ? `${user.Name} (${user.Email})` : user.Email;
  }
}
