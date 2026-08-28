import { Component, inject, OnInit, signal } from "@angular/core";
import { Router } from "@angular/router";
import { AuthStore } from "../../../core/auth/auth.store";
import { RouteRunService } from "../../../core/services/route-run.service";
import { MyRoute } from "../../../core/models/route-run.model";

@Component({
  selector: "app-my-routes",
  imports: [],
  templateUrl: "./my-routes.html",
  styleUrl: "./my-routes.scss"
})
export class MyRoutes implements OnInit {
  private readonly routeRunService = inject(RouteRunService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  readonly routes = signal<MyRoute[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.routes.set(await this.routeRunService.getMyRoutes());
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  isActive(route: MyRoute): boolean {
    return route.Runs.length > 0;
  }

  open(route: MyRoute): void {
    this.router.navigate(["/operateur/route", route.Id]);
  }

  async logout(): Promise<void> {
    await this.authStore.logout();
    await this.router.navigate(["/login"]);
  }
}
