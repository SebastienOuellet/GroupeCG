import { Component, DestroyRef, ElementRef, computed, inject, OnInit, signal, viewChild } from "@angular/core";
import { PortalApiService } from "../../../core/portal/portal-api.service";
import { PortalTracking } from "../../../core/models/portal.model";
import { GoogleMapsService, MapLibraries } from "../../../core/services/google-maps.service";
import { timeAgo } from "../../../core/utils/time-ago";

/** Actualisation pendant une tournée ; en pause quand l'onglet est caché. */
const REFRESH_MS = 30_000;

/**
 * « Déneigement en cours » dans le portail : combien d'arrêts avant le vôtre, où est le
 * tracteur, puis « Votre entrée a été déneigée à … ». Rien d'affiché hors tournée.
 * Le serveur ne renvoie que l'adresse du client et la position du tracteur.
 */
@Component({
  selector: "app-portal-tracking-card",
  template: `
    @if (tracking()?.visit; as v) {
      <div class="card tracking-card" [class.tracking-card--done]="v.status === 'done'">
        @if (v.status === "done") {
          <h2>✅ Votre entrée a été déneigée</h2>
          <p class="tracking-card__lead">à {{ clock(v.doneAt) }}{{ v.confirmedByGps ? " — passage confirmé par le GPS du tracteur" : "" }}.</p>
        } @else if (v.status === "skipped") {
          <h2>Passage reporté</h2>
          <p class="tracking-card__lead">Votre entrée n'a pas pu être déneigée lors de ce passage (ex. véhicule dans l'entrée). Communiquez avec nous au besoin.</p>
        } @else if (v.tractorHere) {
          <h2>🚜 Le déneigeur est chez vous</h2>
          <p class="tracking-card__lead">Votre entrée est en cours de déneigement.</p>
        } @else {
          <h2>🚜 Déneigement en cours dans votre secteur</h2>
          <p class="tracking-card__lead">
            @if (v.stopsBefore === 0) {
              <strong>Vous êtes le prochain arrêt.</strong>
            } @else {
              Il reste <strong>{{ v.stopsBefore }} arrêt{{ v.stopsBefore > 1 ? "s" : "" }}</strong> avant le vôtre.
            }
          </p>
          @if (v.tractor; as t) {
            <p class="tracking-card__hint">Position du déneigeur mise à jour {{ ago(t.recordedAt) }}{{ t.isStale ? " (signal temporairement perdu)" : "" }}.</p>
          }
        }

        @if (showMap()) {
          <div class="tracking-card__map" #map></div>
          @if (mapError()) {
            <p class="tracking-card__hint">Carte indisponible pour le moment.</p>
          }
        }
        @if (v.status === "pending") {
          <p class="tracking-card__hint">L'ordre de passage peut changer selon les conditions. Aucune heure d'arrivée n'est garantie.</p>
        }
      </div>
    }
  `,
  styles: `
    .tracking-card { border-left: 4px solid var(--color-primary); }
    .tracking-card--done { border-left-color: #1e7a3c; }
    .tracking-card h2 { margin-top: 0; }
    .tracking-card__lead { font-size: 1rem; margin: 0 0 0.5rem; }
    .tracking-card__hint { font-size: 0.8125rem; color: #5a646e; margin: 0.25rem 0 0; }
    .tracking-card__map { width: 100%; height: 260px; margin: 0.75rem 0 0.25rem; border-radius: 8px; background: #e9ecef; }
    :host ::ng-deep {
      .portal-tractor, .portal-home {
        display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%;
        background: #fff; font-size: 1.125rem; box-shadow: 0 2px 6px rgb(0 0 0 / 0.3); transform: translateY(50%);
      }
      .portal-tractor { border: 3px solid var(--color-primary); }
      .portal-home { border: 3px solid #1e7a3c; }
    }
  `
})
export class PortalTrackingCard implements OnInit {
  private readonly api = inject(PortalApiService);
  private readonly maps = inject(GoogleMapsService);

  readonly tracking = signal<PortalTracking | null>(null);
  readonly mapError = signal(false);
  private readonly now = signal(Date.now());

  /** Carte seulement pendant l'attente, quand on a le tracteur et l'adresse. */
  readonly showMap = computed(() => {
    const v = this.tracking()?.visit;
    return !!v && this.maps.isEnabled && v.status === "pending" && !!v.tractor && !!v.destination;
  });

  private readonly mapEl = viewChild<ElementRef<HTMLElement>>("map");
  private libs: MapLibraries | null = null;
  private map: google.maps.Map | null = null;
  private mapHost: HTMLElement | null = null;
  private tractorMarker: google.maps.marker.AdvancedMarkerElement | null = null;
  private homeMarker: google.maps.marker.AdvancedMarkerElement | null = null;
  private fitted = false;

  constructor() {
    const timer = setInterval(() => {
      this.now.set(Date.now());
      if (!document.hidden && this.shouldPoll()) void this.refresh();
    }, REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    try {
      this.tracking.set(await this.api.get<PortalTracking>("tracking"));
      // Laisser Angular afficher le conteneur avant d'y dessiner
      await new Promise((resolve) => setTimeout(resolve));
      await this.renderMap();
    } catch {
      // Le suivi est un plus : une erreur ne doit pas gêner le reste du portail
      this.tracking.set(null);
    }
  }

  /**
   * Continuer tant qu'une tournée peut commencer ou est en cours (la page ouverte avant le
   * départ doit voir le tracteur arriver). Arrêter si le suivi est désactivé ou le passage terminé.
   */
  private shouldPoll(): boolean {
    const tracking = this.tracking();
    if (tracking?.enabled === false) return false;
    const visit = tracking?.visit;
    return !visit || visit.inProgress;
  }

  clock(value: string | null): string {
    return value ? new Date(value).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }) : "";
  }

  ago(value: string): string {
    return timeAgo(value, this.now());
  }

  private async renderMap(): Promise<void> {
    const v = this.tracking()?.visit;
    const el = this.mapEl()?.nativeElement;
    if (!v?.tractor || !v.destination || !el) return;
    try {
      this.libs ??= await this.maps.mapLibraries();
      // Le conteneur est recréé quand la carte réapparaît : repartir d'une carte neuve
      if (this.mapHost !== el) {
        this.map = new this.libs.Map(el, { center: { lat: v.destination.latitude, lng: v.destination.longitude }, zoom: 14, mapId: this.maps.mapId, streetViewControl: false, mapTypeControl: false, fullscreenControl: false, clickableIcons: false });
        this.mapHost = el;
        this.tractorMarker = null;
        this.homeMarker = null;
        this.fitted = false;
      }
      const { AdvancedMarkerElement, LatLngBounds } = this.libs;
      const home = { lat: v.destination.latitude, lng: v.destination.longitude };
      const tractor = { lat: v.tractor.latitude, lng: v.tractor.longitude };
      this.homeMarker ??= new AdvancedMarkerElement({ map: this.map, position: home, content: marker("portal-home", "🏠"), title: "Votre adresse" });
      this.tractorMarker ??= new AdvancedMarkerElement({ map: this.map, content: marker("portal-tractor", "🚜"), title: "Déneigeur", zIndex: 10 });
      this.tractorMarker.position = tractor;
      if (!this.fitted) {
        const bounds = new LatLngBounds();
        bounds.extend(home);
        bounds.extend(tractor);
        this.map!.fitBounds(bounds, 48);
        this.fitted = true;
      }
      this.mapError.set(false);
    } catch {
      this.mapError.set(true);
    }
  }
}

const marker = (className: string, emoji: string): HTMLElement => {
  const el = document.createElement("div");
  el.className = className;
  el.textContent = emoji;
  return el;
};
