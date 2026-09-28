import { Component, DestroyRef, ElementRef, computed, inject, OnInit, signal, viewChild } from "@angular/core";
import { DecimalPipe } from "@angular/common";
import { RouterLink } from "@angular/router";
import { TrackingService } from "../../../core/services/tracking.service";
import { GoogleMapsService, MapLibraries } from "../../../core/services/google-maps.service";
import { LiveRun, LiveStop } from "../../../core/models/tracking.model";
import { timeAgo } from "../../../core/utils/time-ago";

/** Actualisation de la carte ; en pause quand l'onglet est caché. */
const REFRESH_MS = 10_000;
/** Au-delà, les arrêts ne s'affichent que pour la tournée sélectionnée (lisibilité et performance). */
const MAX_STOPS_WITHOUT_SELECTION = 400;
const DEFAULT_CENTER = { lat: 45.4042, lng: -71.8929 }; // Sherbrooke
/** Une couleur par tournée (traînée et étiquette du tracteur). */
const RUN_COLORS = ["#052261", "#1a73e8", "#a35200", "#1e7a3c", "#7b3fa0", "#c0392b", "#00838f", "#5d4037"];
const STALE_COLOR = "#8a94a0";

interface RunLayer {
  tractor: google.maps.marker.AdvancedMarkerElement;
  trail: google.maps.Polyline;
}

/**
 * Carte des tournées en cours : position de chaque tracteur, traînée des dernières minutes,
 * état des arrêts. Données de /tracking/live, rafraîchies toutes les 10 s.
 */
@Component({
  selector: "app-live-tracking",
  imports: [RouterLink, DecimalPipe],
  templateUrl: "./live-tracking.html",
  styleUrl: "./live-tracking.scss"
})
export class LiveTracking implements OnInit {
  private readonly tracking = inject(TrackingService);
  private readonly maps = inject(GoogleMapsService);

  readonly runs = signal<LiveRun[]>([]);
  readonly loaded = signal(false);
  readonly error = signal<string | null>(null);
  readonly mapError = signal<string | null>(null);
  readonly selectedRunId = signal<number | null>(null);
  readonly lastRefresh = signal<Date | null>(null);
  /** Horloge pour les « il y a X s » (sans rappeler l'API). */
  readonly now = signal(Date.now());
  readonly mapsEnabled = this.maps.isEnabled;

  readonly selectedRun = computed(() => this.runs().find((run) => run.id === this.selectedRunId()) ?? null);
  readonly staleCount = computed(() => this.runs().filter((run) => run.signal.isStale).length);

  private readonly container = viewChild<ElementRef<HTMLElement>>("mapContainer");
  private libs: MapLibraries | null = null;
  private map: google.maps.Map | null = null;
  private readonly runLayers = new Map<number, RunLayer>();
  private readonly stopMarkers = new Map<number, google.maps.marker.AdvancedMarkerElement>();
  private fitted = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private clock: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearInterval(this.timer);
      if (this.clock) clearInterval(this.clock);
      document.removeEventListener("visibilitychange", this.onVisibility);
    });
  }

  async ngOnInit(): Promise<void> {
    await this.refresh();
    this.timer = setInterval(() => {
      if (!document.hidden) void this.refresh();
    }, REFRESH_MS);
    this.clock = setInterval(() => this.now.set(Date.now()), 5000);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  /** Retour sur l'onglet : actualiser tout de suite plutôt qu'attendre le prochain tick. */
  private readonly onVisibility = (): void => {
    if (!document.hidden) void this.refresh();
  };

  async refresh(): Promise<void> {
    try {
      const response = await this.tracking.getLive();
      this.runs.set(response.runs);
      this.lastRefresh.set(new Date());
      this.error.set(null);
      if (this.selectedRunId() !== null && !response.runs.some((run) => run.id === this.selectedRunId())) {
        this.selectedRunId.set(null);
      }
      this.loaded.set(true);
      // Laisser Angular afficher le conteneur de la carte avant d'y dessiner
      await new Promise((resolve) => setTimeout(resolve));
      await this.render();
    } catch (e) {
      this.error.set((e as Error).message);
      this.loaded.set(true);
    }
  }

  select(run: LiveRun): void {
    const same = this.selectedRunId() === run.id;
    this.selectedRunId.set(same ? null : run.id);
    void this.render();
    if (!same) this.focus(run);
  }

  timeAgo(value: string | null): string {
    return timeAgo(value, this.now());
  }

  colorOf(run: LiveRun): string {
    const index = this.runs().findIndex((r) => r.id === run.id);
    return RUN_COLORS[Math.max(0, index) % RUN_COLORS.length];
  }

  nextStop(run: LiveRun): LiveStop | null {
    return run.stops.find((stop) => stop.status === "pending") ?? null;
  }

  progressPercent(run: LiveRun): number {
    return run.totalCount ? Math.round((run.doneCount / run.totalCount) * 100) : 0;
  }

  /* ---------------------------------------------------------------- */
  /* Carte                                                             */
  /* ---------------------------------------------------------------- */

  private async ensureMap(): Promise<boolean> {
    if (this.map) return true;
    const el = this.container()?.nativeElement;
    if (!el || !this.maps.isEnabled) return false;
    try {
      this.libs = await this.maps.mapLibraries();
      this.map = new this.libs.Map(el, {
        center: DEFAULT_CENTER,
        zoom: 12,
        mapId: this.maps.mapId,
        streetViewControl: false,
        mapTypeControl: true,
        fullscreenControl: true,
        clickableIcons: false
      });
      return true;
    } catch (e) {
      this.mapError.set((e as Error).message);
      return false;
    }
  }

  private async render(): Promise<void> {
    if (!(await this.ensureMap()) || !this.libs || !this.map) return;
    const runs = this.runs();
    this.renderRuns(runs);
    this.renderStops(runs);
    if (!this.fitted && runs.length > 0) {
      this.fitted = this.fitTo(runs);
    }
  }

  private renderRuns(runs: LiveRun[]): void {
    const { AdvancedMarkerElement, Polyline } = this.libs!;
    const map = this.map!;
    const seen = new Set<number>();

    for (const run of runs) {
      seen.add(run.id);
      const color = run.signal.isStale ? STALE_COLOR : this.colorOf(run);
      let layer = this.runLayers.get(run.id);
      if (!layer) {
        const tractor = new AdvancedMarkerElement({ map: null, gmpClickable: true, zIndex: 2000 });
        tractor.addListener("click", () => this.select(run));
        layer = { tractor, trail: new Polyline({ map, clickable: false, strokeWeight: 4, strokeOpacity: 0.75, zIndex: 5 }) };
        this.runLayers.set(run.id, layer);
      }
      layer.trail.setOptions({ path: run.trail.map(([lat, lng]) => ({ lat, lng })), strokeColor: color });

      const position = run.lastPosition;
      if (position) {
        layer.tractor.position = { lat: position.latitude, lng: position.longitude };
        layer.tractor.content = this.tractorElement(run, color);
        layer.tractor.title = `${run.route?.name ?? "Route"} — ${run.vehicle?.name ?? "téléphone"} — ${this.timeAgo(position.recordedAt)}`;
        layer.tractor.map = map;
      } else {
        layer.tractor.map = null;
      }
    }

    for (const [runId, layer] of this.runLayers) {
      if (!seen.has(runId)) {
        layer.tractor.map = null;
        layer.trail.setMap(null);
        this.runLayers.delete(runId);
      }
    }
  }

  private renderStops(runs: LiveRun[]): void {
    const { AdvancedMarkerElement } = this.libs!;
    const map = this.map!;
    const selected = this.selectedRunId();
    const total = runs.reduce((sum, run) => sum + run.stops.length, 0);
    const visibleRuns = selected !== null ? runs.filter((run) => run.id === selected) : total <= MAX_STOPS_WITHOUT_SELECTION ? runs : [];
    const seen = new Set<number>();

    for (const run of visibleRuns) {
      const next = this.nextStop(run);
      for (const stop of run.stops) {
        const address = stop.address;
        if (address?.latitude == null || address.longitude == null) continue;
        seen.add(stop.id);
        let marker = this.stopMarkers.get(stop.id);
        if (!marker) {
          marker = new AdvancedMarkerElement({ map, position: { lat: address.latitude, lng: address.longitude } });
          this.stopMarkers.set(stop.id, marker);
        }
        marker.content = this.stopElement(stop, stop.id === next?.id);
        marker.title = `${stop.sequence}. ${address.label}${stop.status === "done" ? (stop.doneSource === "auto_gps" ? " — fait (GPS)" : " — fait") : stop.status === "skipped" ? " — passé" : stop.arrivedAt ? " — tracteur sur place" : ""}`;
        marker.zIndex = stop.id === next?.id ? 1500 : stop.sequence;
        marker.map = map;
      }
    }

    for (const [stopId, marker] of this.stopMarkers) {
      if (!seen.has(stopId)) {
        marker.map = null;
        this.stopMarkers.delete(stopId);
      }
    }
  }

  private tractorElement(run: LiveRun, color: string): HTMLElement {
    const el = document.createElement("div");
    el.className = "tractor-marker";
    el.style.setProperty("--run-color", color);
    const heading = run.lastPosition?.heading;
    const arrow = heading != null && (run.lastPosition?.speedKmh ?? 0) > 2 ? `<span class="tractor-marker__arrow" style="transform: rotate(${heading}deg)">▲</span>` : "";
    el.innerHTML = `<span class="tractor-marker__icon">🚜</span>${arrow}<span class="tractor-marker__label"></span>`;
    // textContent : le nom de la route vient de l'admin, jamais injecté comme HTML
    el.querySelector(".tractor-marker__label")!.textContent = run.route?.name ?? "";
    return el;
  }

  private stopElement(stop: LiveStop, isNext: boolean): HTMLElement {
    const el = document.createElement("div");
    const here = stop.status === "pending" && !!stop.arrivedAt;
    el.className = `stop-dot stop-dot--${stop.status}${stop.doneSource === "auto_gps" ? " stop-dot--auto" : ""}${here ? " stop-dot--here" : ""}${isNext ? " stop-dot--next" : ""}`;
    el.textContent = String(stop.sequence);
    return el;
  }

  private fitTo(runs: LiveRun[]): boolean {
    const { LatLngBounds } = this.libs!;
    const bounds = new LatLngBounds();
    for (const run of runs) {
      if (run.lastPosition) bounds.extend({ lat: run.lastPosition.latitude, lng: run.lastPosition.longitude });
      for (const stop of run.stops) {
        if (stop.address?.latitude != null && stop.address.longitude != null) bounds.extend({ lat: stop.address.latitude, lng: stop.address.longitude });
      }
    }
    if (bounds.isEmpty()) return false;
    this.map!.fitBounds(bounds, 48);
    return true;
  }

  private focus(run: LiveRun): void {
    if (!this.map) return;
    if (run.lastPosition) {
      this.map.panTo({ lat: run.lastPosition.latitude, lng: run.lastPosition.longitude });
      if ((this.map.getZoom() ?? 0) < 14) this.map.setZoom(15);
    } else {
      this.fitTo([run]);
    }
  }
}
