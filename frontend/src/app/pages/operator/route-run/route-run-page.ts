import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { RouteRunService } from "../../../core/services/route-run.service";
import { RouteModel } from "../../../core/models/domain.model";
import { RouteRun, RouteRunStop, RouteRunStopStatus } from "../../../core/models/route-run.model";
import { SurfaceBadge } from "../../../shared/surface-badge/surface-badge";

@Component({
  selector: "app-route-run-page",
  imports: [SurfaceBadge],
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

  /** Premier arrêt encore à faire, dans l'ordre figé de la tournée. */
  readonly nextStopId = computed(() => this.run()?.Stops?.find((s) => s.Status === "pending")?.Id ?? null);

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
      this.scrollToNext("auto");
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
      this.scrollToNext("auto");
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
        // La réponse n'inclut pas le contrat : on garde celui déjà chargé
        run.Stops = run.Stops.map((s) => (s.Id === updated.Id ? { ...s, ...updated, Contract: s.Contract } : s));
        this.run.set({ ...run });
        if (status !== "pending") this.scrollToNext("smooth");
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

  private scrollToNext(behavior: ScrollBehavior): void {
    const id = this.nextStopId();
    if (id === null) return;
    // Après le rendu de la liste
    setTimeout(() => document.getElementById(`stop-${id}`)?.scrollIntoView({ behavior, block: "center" }));
  }

  /**
   * Lien Google Maps « itinéraire » : ouvre l'app GPS du téléphone, gratuit et sans clé.
   * Coordonnées si connues (pin corrigé = exact), sinon l'adresse en texte ; PlaceId en plus quand on l'a.
   */
  navigationUrl(stop: RouteRunStop): string | null {
    const a = stop.Contract?.ServiceAddress;
    if (!a) return null;
    const hasCoords = a.Latitude !== null && a.Latitude !== undefined && a.Longitude !== null && a.Longitude !== undefined;
    const destination = hasCoords ? `${Number(a.Latitude)},${Number(a.Longitude)}` : `${a.CivicNumber} ${a.Street}, ${a.City}, QC ${a.PostalCode}`;
    const params = new URLSearchParams({ api: "1", destination, travelmode: "driving" });
    // Un pin corrigé à la main prime : le place_id ramènerait l'adresse Google (souvent le bord du chemin)
    if (a.PlaceId && a.LocationSource !== "manual_pin") params.set("destination_place_id", a.PlaceId);
    return `https://www.google.com/maps/dir/?${params.toString()}`;
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
