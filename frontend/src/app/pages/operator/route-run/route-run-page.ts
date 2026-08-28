import { Component, inject, OnInit, signal } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { RouteRunService } from "../../../core/services/route-run.service";
import { RouteModel } from "../../../core/models/domain.model";
import { RouteRun, RouteRunStop, RouteRunStopStatus } from "../../../core/models/route-run.model";

@Component({
  selector: "app-route-run-page",
  imports: [],
  templateUrl: "./route-run-page.html",
  styleUrl: "./route-run-page.scss"
})
export class RouteRunPage implements OnInit {
  private readonly routeParam = inject(ActivatedRoute);
  private readonly routeRunService = inject(RouteRunService);
  private readonly router = inject(Router);

  readonly route = signal<RouteModel | null>(null);
  readonly run = signal<RouteRun | null>(null);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);

  private routeId!: number;

  async ngOnInit(): Promise<void> {
    this.routeId = Number(this.routeParam.snapshot.paramMap.get("id"));
    await this.load();
  }

  async load(): Promise<void> {
    this.error.set(null);
    try {
      const { route, run } = await this.routeRunService.getCurrentRun(this.routeId);
      this.route.set(route);
      this.run.set(run);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  async startRoute(): Promise<void> {
    if (!confirm("Démarrer la tournée ? Un avis sera envoyé aux résidents de cette route.")) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const run = await this.routeRunService.start(this.routeId);
      this.run.set(run);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  async setStopStatus(stop: RouteRunStop, status: RouteRunStopStatus): Promise<void> {
    this.error.set(null);
    try {
      const updated = await this.routeRunService.updateStop(stop.Id, status);
      const run = this.run();
      if (run?.Stops) {
        run.Stops = run.Stops.map((s) => (s.Id === updated.Id ? updated : s));
        this.run.set({ ...run });
      }
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  async completeRoute(): Promise<void> {
    const run = this.run();
    if (!run) return;
    if (!confirm("Terminer la tournée ?")) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.routeRunService.complete(run.Id);
      await this.router.navigate(["/operateur"]);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  back(): void {
    this.router.navigate(["/operateur"]);
  }

  addressLabel(stop: RouteRunStop): string {
    const address = stop.Contract?.ServiceAddress;
    return address ? `${address.CivicNumber} ${address.Street}` : "—";
  }

  clientLabel(stop: RouteRunStop): string {
    const client = stop.Contract?.Client;
    if (!client) return "—";
    const person = [client.FirstName, client.LastName].filter(Boolean).join(" ");
    return client.CompanyName || person || `#${client.ClientNumber}`;
  }

  get doneCount(): number {
    return (this.run()?.Stops ?? []).filter((s) => s.Status !== "pending").length;
  }

  get totalCount(): number {
    return this.run()?.Stops?.length ?? 0;
  }
}
