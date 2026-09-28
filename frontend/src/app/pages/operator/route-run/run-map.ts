import { Component, DestroyRef, ElementRef, effect, inject, input, output, signal, untracked, viewChild } from "@angular/core";
import { GoogleMapsService, LatLng, MapLibraries } from "../../../core/services/google-maps.service";

/** Arrêt de la tournée sur la carte de l'opérateur (seulement ceux qui ont des coordonnées). */
export interface RunMapStop {
  id: number;
  sequence: number;
  status: "pending" | "done" | "skipped";
  /** Fait détecté par le GPS (géorepérage). */
  auto: boolean;
  /** Tracteur dans l'entrée en ce moment. */
  here: boolean;
  label: string;
  lat: number;
  lng: number;
}

export interface RunMapPoint extends LatLng {
  label: string;
}

export interface RunMapTractor extends LatLng {
  heading: number | null;
  stale: boolean;
}

const DEFAULT_CENTER = { lat: 45.4042, lng: -71.8929 }; // Sherbrooke
const COLOR_DONE = "#9aa3ad";
const COLOR_TODO = "#1a73e8";
const COLOR_NEXT = "#052261";

type LegState = "done" | "next" | "todo";

/**
 * Carte de la tournée pour l'opérateur : arrêts numérotés selon leur état, trajet routier
 * tronçon par tronçon (fait en gris, prochain tronçon en évidence), position du tracteur.
 *
 * Le trajet routier (Google Routes API) est calculé une seule fois par ensemble d'arrêts
 * (≈ 1 requête par 25 arrêts), puis seuls les styles changent quand des arrêts sont faits.
 * Rien n'est enregistré (conditions Google). Sans Routes API : lignes droites entre les arrêts.
 */
@Component({
  selector: "app-run-map",
  template: `
    <div class="run-map" #container></div>
    <div class="run-map__controls">
      <button type="button" class="run-map__btn" (click)="centerOnTractor()" [disabled]="!tractor()">🚜 Tracteur</button>
      <button type="button" class="run-map__btn" (click)="fitAll()">⤢ Toute la route</button>
    </div>
    @if (roadState() === "straight") {
      <p class="run-map__note">Trajet routier indisponible : lignes droites entre les arrêts.</p>
    } @else if (roadSummary(); as summary) {
      <p class="run-map__note">{{ summary }}</p>
    }
    @if (error()) {
      <p class="run-map__error">Carte indisponible : {{ error() }}</p>
    }
  `,
  styles: `
    :host { display: block; position: relative; }
    .run-map { width: 100%; height: 100%; min-height: 280px; border-radius: 10px; background: #e9ecef; }
    .run-map__controls { position: absolute; top: 0.5rem; left: 0.5rem; display: flex; gap: 0.375rem; }
    .run-map__btn {
      min-height: 40px; padding: 0.35rem 0.75rem; border: 1px solid #d0d5dd; border-radius: 99px;
      background: #fff; color: var(--color-primary); font-weight: 700; font-size: 0.8125rem;
      box-shadow: 0 1px 4px rgb(0 0 0 / 0.15);
    }
    .run-map__btn:disabled { opacity: 0.5; }
    .run-map__note {
      position: absolute; left: 0.5rem; bottom: 0.5rem; margin: 0; padding: 0.3rem 0.6rem;
      max-width: calc(100% - 1rem); border-radius: 6px; background: rgb(255 255 255 / 0.92);
      font-size: 0.75rem; color: #3a434c;
    }
    .run-map__error {
      position: absolute; inset: auto 0.5rem 0.5rem; margin: 0; padding: 0.5rem 0.75rem;
      background: #fff; border-radius: 6px; font-size: 0.8125rem; color: #a02020;
    }
    :host ::ng-deep {
      .run-stop {
        display: grid; place-items: center; min-width: 24px; height: 24px; padding: 0 4px;
        border-radius: 12px; border: 2px solid ${COLOR_NEXT}; background: #fff; color: ${COLOR_NEXT};
        font-size: 0.6875rem; font-weight: 800; box-sizing: border-box; transform: translateY(50%);
      }
      .run-stop--done { border-color: #1e7a3c; background: #1e7a3c; color: #fff; }
      .run-stop--skipped { border-color: #8a94a0; background: #eef0f3; color: #5a646e; }
      .run-stop--next { min-width: 32px; height: 32px; border-radius: 16px; font-size: 0.875rem; border-color: #f5b400; box-shadow: 0 0 0 4px rgb(245 180 0 / 0.35); }
      .run-stop--here { border-color: #f5b400; background: #fff4cc; }
      .run-stop--selected { outline: 3px solid ${COLOR_TODO}; outline-offset: 2px; }
      .run-endpoint {
        display: grid; place-items: center; width: 26px; height: 26px; border-radius: 6px;
        background: #2f3840; color: #fff; font-size: 0.75rem; font-weight: 800; transform: translateY(50%);
      }
      .run-tractor {
        display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%;
        border: 3px solid ${COLOR_NEXT}; background: #fff; font-size: 1.25rem;
        box-shadow: 0 2px 8px rgb(0 0 0 / 0.35); transform: translateY(50%);
      }
      .run-tractor--stale { border-color: #8a94a0; opacity: 0.7; }
    }
  `
})
export class RunMap {
  private readonly maps = inject(GoogleMapsService);

  readonly stops = input.required<RunMapStop[]>();
  readonly endpoint = input<RunMapPoint | null>(null);
  readonly nextStopId = input<number | null>(null);
  readonly selectedStopId = input<number | null>(null);
  readonly tractor = input<RunMapTractor | null>(null);

  readonly stopClicked = output<number>();

  readonly error = signal<string | null>(null);
  /** road = trajet Google ; straight = repli en lignes droites. */
  readonly roadState = signal<"pending" | "road" | "straight">("pending");
  readonly roadSummary = signal<string | null>(null);

  private readonly container = viewChild.required<ElementRef<HTMLElement>>("container");
  private libs: MapLibraries | null = null;
  private map: google.maps.Map | null = null;
  private readonly stopMarkers = new Map<number, google.maps.marker.AdvancedMarkerElement>();
  private endpointMarker: google.maps.marker.AdvancedMarkerElement | null = null;
  private tractorMarker: google.maps.marker.AdvancedMarkerElement | null = null;
  private legLines: google.maps.Polyline[] = [];
  /** Tracé de chaque tronçon ; recalculé seulement si l'ensemble des arrêts change. */
  private legPaths: LatLng[][] | null = null;
  private tourKey = "";
  private fitted = false;

  constructor() {
    effect(() => {
      const stops = this.stops();
      const endpoint = this.endpoint();
      const next = this.nextStopId();
      const selected = this.selectedStopId();
      const tractor = this.tractor();
      const el = this.container().nativeElement;
      untracked(() => void this.render(el, stops, endpoint, next, selected, tractor));
    });
    inject(DestroyRef).onDestroy(() => {
      for (const marker of this.stopMarkers.values()) marker.map = null;
      this.clearLegs();
    });
  }

  centerOnTractor(): void {
    const t = this.tractor();
    if (!t || !this.map) return;
    this.map.panTo(t);
    if ((this.map.getZoom() ?? 0) < 16) this.map.setZoom(17);
  }

  fitAll(): void {
    if (!this.map || !this.libs) return;
    const bounds = new this.libs.LatLngBounds();
    for (const point of this.tourPoints(this.stops(), this.endpoint())) bounds.extend(point);
    const t = this.tractor();
    if (t) bounds.extend(t);
    if (!bounds.isEmpty()) this.map.fitBounds(bounds, 48);
  }

  /** Départ → arrêts dans l'ordre → retour. Le tronçon i arrive au point i + 1. */
  private tourPoints(stops: RunMapStop[], endpoint: RunMapPoint | null): LatLng[] {
    const points = stops.map((s) => ({ lat: s.lat, lng: s.lng }));
    return endpoint && points.length > 0 ? [endpoint, ...points, endpoint] : points;
  }

  private async ensureMap(el: HTMLElement): Promise<boolean> {
    if (this.map) return true;
    if (!this.maps.isEnabled) {
      this.error.set("clé Google Maps non configurée.");
      return false;
    }
    try {
      this.libs = await this.maps.mapLibraries();
      this.map = new this.libs.Map(el, {
        center: DEFAULT_CENTER,
        zoom: 13,
        mapId: this.maps.mapId,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
        clickableIcons: false,
        gestureHandling: "greedy"
      });
      return true;
    } catch (e) {
      this.error.set((e as Error).message);
      return false;
    }
  }

  private async render(
    el: HTMLElement,
    stops: RunMapStop[],
    endpoint: RunMapPoint | null,
    next: number | null,
    selected: number | null,
    tractor: RunMapTractor | null
  ): Promise<void> {
    if (!(await this.ensureMap(el)) || !this.libs || !this.map) return;
    this.renderStops(stops, next, selected);
    this.renderEndpoint(endpoint);
    this.renderTractor(tractor);

    const key = [endpoint ? `${endpoint.lat},${endpoint.lng}` : "", ...stops.map((s) => `${s.id}:${s.lat},${s.lng}`)].join("|");
    if (key !== this.tourKey) {
      this.tourKey = key;
      this.legPaths = null;
      void this.loadRoad(key, this.tourPoints(stops, endpoint));
    }
    this.renderLegs(stops, endpoint, next);

    if (!this.fitted && stops.length > 0) {
      this.fitted = true;
      this.fitAll();
    }
  }

  private async loadRoad(key: string, points: LatLng[]): Promise<void> {
    if (points.length < 2) return;
    this.roadState.set("pending");
    try {
      const { legs } = await this.maps.computeDrivingLegs(points);
      if (key !== this.tourKey) return; // les arrêts ont changé pendant le calcul
      this.legPaths = legs.map((leg) => leg.path);
      this.roadState.set("road");
      const km = legs.reduce((sum, leg) => sum + leg.distanceMeters, 0) / 1000;
      const minutes = Math.round(legs.reduce((sum, leg) => sum + leg.durationSeconds, 0) / 60);
      this.roadSummary.set(`Trajet complet : ${km.toFixed(1)} km, ${minutes} min de route (sans le déneigement)`);
    } catch {
      if (key !== this.tourKey) return;
      this.legPaths = null;
      this.roadState.set("straight");
      this.roadSummary.set(null);
    }
    this.renderLegs(this.stops(), this.endpoint(), this.nextStopId());
  }

  private legStates(stops: RunMapStop[], endpoint: RunMapPoint | null, next: number | null): LegState[] {
    // Arrivée de chaque tronçon : les arrêts, puis le retour au départ
    const arrivals: (RunMapStop | "return")[] = endpoint && stops.length > 0 ? [...stops, "return"] : stops.slice(1);
    const allHandled = stops.every((s) => s.status !== "pending");
    return arrivals.map((arrival) => {
      if (arrival === "return") return allHandled ? "next" : "todo";
      if (arrival.id === next) return "next";
      return arrival.status === "pending" ? "todo" : "done";
    });
  }

  private clearLegs(): void {
    for (const line of this.legLines) line.setMap(null);
    this.legLines = [];
  }

  private renderLegs(stops: RunMapStop[], endpoint: RunMapPoint | null, next: number | null): void {
    if (!this.map || !this.libs) return;
    const points = this.tourPoints(stops, endpoint);
    const states = this.legStates(stops, endpoint, next);
    const paths = this.legPaths ?? points.slice(1).map((point, i) => [points[i], point]);
    const straight = this.legPaths === null;
    this.clearLegs();
    paths.forEach((path, i) => {
      const state = states[i] ?? "todo";
      this.legLines.push(
        new this.libs!.Polyline({
          map: this.map,
          path,
          clickable: false,
          strokeColor: state === "done" ? COLOR_DONE : state === "next" ? COLOR_NEXT : COLOR_TODO,
          strokeOpacity: state === "done" ? 0.6 : straight ? 0.5 : 0.85,
          strokeWeight: state === "next" ? 7 : state === "done" ? 3 : 4,
          zIndex: state === "next" ? 20 : state === "todo" ? 10 : 5,
          icons:
            state === "done"
              ? []
              : [{ icon: { path: google.maps.SymbolPath.FORWARD_OPEN_ARROW, scale: 2, strokeColor: "#fff", strokeWeight: 2 }, offset: "30px", repeat: "110px" }]
        })
      );
    });
  }

  private renderStops(stops: RunMapStop[], next: number | null, selected: number | null): void {
    const { AdvancedMarkerElement } = this.libs!;
    const seen = new Set<number>();
    for (const stop of stops) {
      seen.add(stop.id);
      let marker = this.stopMarkers.get(stop.id);
      if (!marker) {
        marker = new AdvancedMarkerElement({ map: this.map, position: { lat: stop.lat, lng: stop.lng }, gmpClickable: true });
        marker.addListener("click", () => this.stopClicked.emit(stop.id));
        this.stopMarkers.set(stop.id, marker);
      }
      marker.position = { lat: stop.lat, lng: stop.lng };
      const el = document.createElement("div");
      const classes = ["run-stop", `run-stop--${stop.status}`];
      if (stop.id === next) classes.push("run-stop--next");
      if (stop.here) classes.push("run-stop--here");
      if (stop.id === selected) classes.push("run-stop--selected");
      el.className = classes.join(" ");
      el.textContent = String(stop.sequence);
      marker.content = el;
      marker.title = `${stop.sequence}. ${stop.label}${stop.status === "done" ? (stop.auto ? " — fait (GPS)" : " — fait") : stop.status === "skipped" ? " — passé" : ""}`;
      marker.zIndex = stop.id === next ? 1000 : stop.id === selected ? 900 : stop.status === "pending" ? 500 - stop.sequence : 1;
    }
    for (const [id, marker] of this.stopMarkers) {
      if (!seen.has(id)) {
        marker.map = null;
        this.stopMarkers.delete(id);
      }
    }
  }

  private renderEndpoint(endpoint: RunMapPoint | null): void {
    const { AdvancedMarkerElement } = this.libs!;
    if (!endpoint) {
      if (this.endpointMarker) this.endpointMarker.map = null;
      return;
    }
    if (!this.endpointMarker) {
      const el = document.createElement("div");
      el.className = "run-endpoint";
      el.textContent = "D";
      this.endpointMarker = new AdvancedMarkerElement({ map: this.map, content: el, zIndex: 50 });
    }
    this.endpointMarker.position = endpoint;
    this.endpointMarker.title = `Départ et retour : ${endpoint.label}`;
    this.endpointMarker.map = this.map;
  }

  private renderTractor(tractor: RunMapTractor | null): void {
    const { AdvancedMarkerElement } = this.libs!;
    if (!tractor) {
      if (this.tractorMarker) this.tractorMarker.map = null;
      return;
    }
    if (!this.tractorMarker) {
      this.tractorMarker = new AdvancedMarkerElement({ map: this.map, zIndex: 2000 });
    }
    const el = document.createElement("div");
    el.className = `run-tractor${tractor.stale ? " run-tractor--stale" : ""}`;
    el.textContent = "🚜";
    this.tractorMarker.content = el;
    this.tractorMarker.position = { lat: tractor.lat, lng: tractor.lng };
    this.tractorMarker.title = tractor.stale ? "Dernière position connue (signal ancien)" : "Position du tracteur";
    this.tractorMarker.map = this.map;
  }
}
