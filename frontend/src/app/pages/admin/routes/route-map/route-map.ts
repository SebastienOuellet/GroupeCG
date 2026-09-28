import { Component, DestroyRef, ElementRef, effect, inject, input, output, signal, untracked, viewChild } from "@angular/core";
import { GoogleMapsService, LatLng, MapLibraries } from "../../../../core/services/google-maps.service";

/** Arrêt affiché sur la carte ; `number` null = pas encore placé dans l'ordre. */
export interface RouteMapStop {
  id: number;
  number: number | null;
  label: string;
  lat: number;
  lng: number;
  /** Pin corrigé à la main (affiché autrement). */
  manual: boolean;
}

export interface RouteMapEndpoint {
  label: string;
  lat: number;
  lng: number;
}

export interface PinMove extends LatLng {
  id: number;
}

const COLOR_PLACED = "#052261";
const COLOR_UNPLACED = "#a06000";
const COLOR_MANUAL = "#1e7a3c";
const COLOR_ENDPOINT = "#2f3840";
const COLOR_COMPARE = "#8a94a0";
/** Zoom si un seul point : Estrie, échelle d'une rue. */
const SINGLE_POINT_ZOOM = 15;
const DEFAULT_CENTER = { lat: 45.4042, lng: -71.8929 }; // Sherbrooke

const readLatLng = (position: google.maps.marker.AdvancedMarkerElement["position"]): LatLng | null => {
  if (!position) return null;
  const p = position as google.maps.LatLng | google.maps.LatLngLiteral;
  return typeof p.lat === "function" ? { lat: (p as google.maps.LatLng).lat(), lng: (p as google.maps.LatLng).lng() } : (p as google.maps.LatLngLiteral);
};

/**
 * Carte d'une route : pins numérotés dans l'ordre de passage, point de départ/retour,
 * tracé à vol d'oiseau (indicatif : l'ordre, pas le chemin routier).
 * En mode `editable`, les pins se déplacent (correction d'une adresse mal géocodée).
 */
@Component({
  selector: "app-route-map",
  template: `
    <div class="route-map" #container></div>
    @if (state() === "error") {
      <p class="route-map__error">Carte indisponible : {{ errorMessage() }}</p>
    }
  `,
  styles: `
    :host { display: block; position: relative; }
    .route-map { width: 100%; height: 100%; min-height: 320px; border-radius: 8px; background: #e9ecef; }
    .route-map__error { position: absolute; inset: auto 0.75rem 0.75rem; margin: 0; padding: 0.5rem 0.75rem; background: #fff; border-radius: 6px; font-size: 0.8125rem; color: #a02020; }
  `
})
export class RouteMap {
  private readonly maps = inject(GoogleMapsService);

  readonly stops = input.required<RouteMapStop[]>();
  readonly endpoint = input<RouteMapEndpoint | null>(null);
  readonly editable = input(false);
  readonly highlightedId = input<number | null>(null);
  /** Tracé de comparaison (ex. ordre enregistré pendant l'aperçu d'une optimisation), en pointillé. */
  readonly comparePath = input<{ lat: number; lng: number }[] | null>(null);

  readonly pinMoved = output<PinMove>();
  readonly stopClicked = output<number>();

  readonly state = signal<"loading" | "ready" | "error">("loading");
  readonly errorMessage = signal("");

  private readonly container = viewChild.required<ElementRef<HTMLElement>>("container");
  private libs: MapLibraries | null = null;
  private map: google.maps.Map | null = null;
  private markers: google.maps.marker.AdvancedMarkerElement[] = [];
  private line: google.maps.Polyline | null = null;
  private compareLine: google.maps.Polyline | null = null;
  /** Recadrer seulement quand l'ensemble des points change, pas à chaque réordonnancement. */
  private lastBoundsKey = "";

  constructor() {
    effect(() => {
      const stops = this.stops();
      const endpoint = this.endpoint();
      const editable = this.editable();
      const highlighted = this.highlightedId();
      const compare = this.comparePath();
      const el = this.container().nativeElement;
      untracked(() => void this.render(el, stops, endpoint, editable, highlighted, compare));
    });
    inject(DestroyRef).onDestroy(() => this.clear());
  }

  private async ensureMap(el: HTMLElement): Promise<boolean> {
    if (this.map) return true;
    if (!this.maps.isEnabled) {
      this.errorMessage.set("clé Google Maps non configurée.");
      this.state.set("error");
      return false;
    }
    try {
      this.libs = await this.maps.mapLibraries();
      this.map ??= new this.libs.Map(el, {
        center: DEFAULT_CENTER,
        zoom: 12,
        mapId: this.maps.mapId,
        streetViewControl: false,
        mapTypeControl: true,
        fullscreenControl: true,
        clickableIcons: false
      });
      this.state.set("ready");
      return true;
    } catch (e) {
      this.errorMessage.set((e as Error).message);
      this.state.set("error");
      return false;
    }
  }

  private clear(): void {
    for (const marker of this.markers) marker.map = null;
    this.markers = [];
    this.line?.setMap(null);
    this.line = null;
    this.compareLine?.setMap(null);
    this.compareLine = null;
  }

  private async render(
    el: HTMLElement,
    stops: RouteMapStop[],
    endpoint: RouteMapEndpoint | null,
    editable: boolean,
    highlighted: number | null,
    compare: { lat: number; lng: number }[] | null
  ): Promise<void> {
    if (!(await this.ensureMap(el)) || !this.libs || !this.map) return;
    const { AdvancedMarkerElement, PinElement, Polyline, LatLngBounds } = this.libs;
    const map = this.map;
    this.clear();

    const bounds = new LatLngBounds();

    if (endpoint) {
      const pin = new PinElement({ background: COLOR_ENDPOINT, borderColor: "#fff", glyphText: "D", glyphColor: "#fff", scale: 1.2 });
      this.markers.push(new AdvancedMarkerElement({ map, position: endpoint, content: pin, title: `Départ et retour : ${endpoint.label}`, zIndex: 1000 }));
      bounds.extend(endpoint);
    }

    for (const stop of stops) {
      const isHighlighted = stop.id === highlighted;
      const background = stop.number === null ? COLOR_UNPLACED : stop.manual ? COLOR_MANUAL : COLOR_PLACED;
      const pin = new PinElement({
        background,
        borderColor: isHighlighted ? "#f5b400" : "#fff",
        glyphText: stop.number === null ? "?" : String(stop.number),
        glyphColor: "#fff",
        scale: isHighlighted ? 1.35 : 1
      });
      const marker = new AdvancedMarkerElement({
        map,
        position: { lat: stop.lat, lng: stop.lng },
        content: pin,
        title: `${stop.number ?? "À placer"} — ${stop.label}${stop.manual ? " (pin corrigé)" : ""}`,
        gmpDraggable: editable,
        gmpClickable: true,
        zIndex: isHighlighted ? 999 : stop.number ?? 0
      });
      marker.addListener("click", () => this.stopClicked.emit(stop.id));
      if (editable) {
        marker.addListener("dragend", () => {
          const position = readLatLng(marker.position);
          if (position) this.pinMoved.emit({ id: stop.id, ...position });
        });
      }
      this.markers.push(marker);
      bounds.extend({ lat: stop.lat, lng: stop.lng });
    }

    // Tracé de l'ordre : départ → arrêts placés → retour
    const path = stops.filter((s) => s.number !== null).map((s) => ({ lat: s.lat, lng: s.lng }));
    if (endpoint && path.length > 0) {
      path.unshift({ lat: endpoint.lat, lng: endpoint.lng });
      path.push({ lat: endpoint.lat, lng: endpoint.lng });
    }
    if (path.length > 1) {
      this.line = new Polyline({ map, path, strokeColor: COLOR_PLACED, strokeOpacity: 0.7, strokeWeight: 3, clickable: false, zIndex: 2 });
    }
    if (compare && compare.length > 1) {
      // Pointillé gris : l'ordre avant optimisation, pour voir la différence d'un coup d'œil
      this.compareLine = new Polyline({
        map,
        path: compare,
        strokeOpacity: 0,
        clickable: false,
        zIndex: 1,
        icons: [{ icon: { path: "M 0,-1 0,1", strokeColor: COLOR_COMPARE, strokeOpacity: 0.8, scale: 2 }, offset: "0", repeat: "10px" }]
      });
    }

    const boundsKey = [endpoint ? `${endpoint.lat},${endpoint.lng}` : "", ...stops.map((s) => `${s.id}:${s.lat},${s.lng}`).sort()].join("|");
    if (boundsKey !== this.lastBoundsKey && !bounds.isEmpty()) {
      this.lastBoundsKey = boundsKey;
      const points = stops.length + (endpoint ? 1 : 0);
      if (points === 1) {
        map.setCenter(bounds.getCenter());
        map.setZoom(SINGLE_POINT_ZOOM);
      } else {
        map.fitBounds(bounds, 40);
      }
    }
  }
}
