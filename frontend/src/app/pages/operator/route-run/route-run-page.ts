import { Component, computed, DestroyRef, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { RouteRunService } from "../../../core/services/route-run.service";
import { RouteModel } from "../../../core/models/domain.model";
import { RouteRun, RouteRunStop, RouteRunStopStatus } from "../../../core/models/route-run.model";
import { SurfaceBadge } from "../../../shared/surface-badge/surface-badge";
import { VehicleService } from "../../../core/services/vehicle.service";
import { PhoneGpsService } from "../../../core/services/phone-gps.service";
import { AvailableVehicle } from "../../../core/models/vehicle.model";
import { timeAgo } from "../../../core/utils/time-ago";

/** Rafraîchit la tournée (état du signal GPS, arrêts) pendant qu'elle est ouverte. */
const REFRESH_MS = 30_000;

@Component({
  selector: "app-route-run-page",
  imports: [SurfaceBadge, FormsModule],
  templateUrl: "./route-run-page.html",
  styleUrl: "./route-run-page.scss"
})
export class RouteRunPage implements OnInit {
  private readonly routeParam = inject(ActivatedRoute);
  private readonly routeRunService = inject(RouteRunService);
  private readonly router = inject(Router);
  private readonly vehicleService = inject(VehicleService);
  readonly phoneGps = inject(PhoneGpsService);

  readonly route = signal<RouteModel | null>(null);
  readonly run = signal<RouteRun | null>(null);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);

  /** Tracteurs proposés au démarrage ; null = aucun (GPS du téléphone seulement). */
  readonly vehicles = signal<AvailableVehicle[]>([]);
  selectedVehicleId: number | null = null;
  /** Horloge des « il y a X s ». */
  readonly now = signal(Date.now());

  /** Premier arrêt encore à faire, dans l'ordre figé de la tournée. */
  readonly nextStopId = computed(() => this.run()?.Stops?.find((s) => s.Status === "pending")?.Id ?? null);

  private routeId!: number;

  constructor() {
    const timer = setInterval(() => {
      this.now.set(Date.now());
      if (this.run() && !this.busy() && !document.hidden && Date.now() - this.lastLoad >= REFRESH_MS) void this.load(false);
    }, 5000);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      // Quitter la page coupe le GPS du téléphone ; il reprend au retour sur la tournée
      this.phoneGps.stop();
    });
  }

  private lastLoad = 0;

  async ngOnInit(): Promise<void> {
    this.routeId = Number(this.routeParam.snapshot.paramMap.get("id"));
    await this.load();
  }

  async load(scroll = true): Promise<void> {
    this.lastLoad = Date.now();
    if (scroll) this.error.set(null);
    try {
      const { route, run } = await this.routeRunService.getCurrentRun(this.routeId);
      this.route.set(route);
      this.run.set(run);
      if (scroll) this.scrollToNext("auto");
      if (run) {
        if (!this.phoneGps.active() && this.phoneGps.wasEnabledFor(run.Id)) this.phoneGps.start(run.Id);
      } else if (scroll) {
        await this.loadVehicles(route.DefaultVehicleId ?? null);
      }
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  /** Tracteur proposé : celui de la route s'il est libre. */
  private async loadVehicles(defaultVehicleId: number | null): Promise<void> {
    try {
      const vehicles = await this.vehicleService.getAvailable();
      this.vehicles.set(vehicles);
      const preferred = vehicles.find((v) => v.Id === defaultVehicleId && !v.InUseByRoute);
      this.selectedVehicleId = preferred?.Id ?? null;
    } catch {
      this.vehicles.set([]); // sans liste, on démarre sans tracteur
    }
  }

  async startRoute(): Promise<void> {
    if (!confirm("Démarrer la tournée ? Un avis sera envoyé aux résidents de cette route.")) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const run = await this.routeRunService.start(this.routeId, this.vehicles().length > 0 ? this.selectedVehicleId : undefined);
      this.run.set(run);
      this.lastLoad = Date.now();
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
      this.phoneGps.stop(true);
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

  togglePhoneGps(enabled: boolean): void {
    const run = this.run();
    if (!run) return;
    if (enabled) this.phoneGps.start(run.Id);
    else this.phoneGps.stop(true);
  }

  /** « il y a 12 s » du dernier signal reçu par le serveur (appareil du tracteur ou ce téléphone). */
  signalAgo(): string {
    return timeAgo(this.run()?.Signal?.lastPositionAt ?? null, this.now());
  }

  /** Muet si le serveur n'a rien reçu depuis 2 min, sauf si ce téléphone vient d'envoyer. */
  signalIsStale(): boolean {
    const sent = this.phoneGps.lastSentAt();
    if (this.phoneGps.active() && sent && this.now() - sent.getTime() < 120_000) return false;
    return this.run()?.Signal?.isStale ?? true;
  }

  phoneFixAgo(): string {
    return timeAgo(this.phoneGps.lastFixAt(), this.now());
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
