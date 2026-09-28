import { Component, ElementRef, effect, inject, input, output, signal, untracked, viewChild } from "@angular/core";
import { GeocodedPlace, GoogleMapsService, LatLng } from "../../core/services/google-maps.service";

type ViewState = "loading" | "ready" | "no-coverage" | "not-found" | "error";

/**
 * Vue Street View interactive orientée vers l'entrée de l'adresse.
 * - Avec `latitude`/`longitude` : affichage direct.
 * - Sans coordonnées (adresse saisie avant l'autocomplete) : géocode `addressText` et émet
 *   `located` pour que le parent puisse enregistrer les coordonnées une fois pour toutes.
 */
@Component({
  selector: "app-street-view",
  templateUrl: "./street-view.html",
  styleUrl: "./street-view.scss"
})
export class StreetView {
  private readonly maps = inject(GoogleMapsService);

  readonly latitude = input<number | string | null | undefined>(null);
  readonly longitude = input<number | string | null | undefined>(null);
  readonly addressText = input("");
  readonly located = output<GeocodedPlace>();

  private readonly container = viewChild<ElementRef<HTMLDivElement>>("pano");

  readonly enabled = this.maps.isEnabled;
  readonly state = signal<ViewState>("loading");
  readonly errorMessage = signal("");

  private renderSeq = 0;

  constructor() {
    effect(() => {
      // Sequelize renvoie les DECIMAL en chaîne : on normalise
      const lat = toNumber(this.latitude());
      const lng = toNumber(this.longitude());
      const text = this.addressText();
      // Vide tant que la vue n'est pas créée : l'effet se relance quand le conteneur apparaît
      const el = this.container()?.nativeElement;
      if (!el) return;
      untracked(() => void this.render(el, lat, lng, text));
    });
  }

  private async render(el: HTMLElement, lat: number | null, lng: number | null, text: string): Promise<void> {
    const seq = ++this.renderSeq;
    this.state.set("loading");
    try {
      let target: LatLng | null = lat !== null && lng !== null ? { lat, lng } : null;
      if (!target && text.trim()) {
        const found = await this.maps.geocode(text);
        target = found;
        if (found && seq === this.renderSeq) this.located.emit(found);
      }
      if (seq !== this.renderSeq) return;
      if (!target) {
        this.state.set("not-found");
        return;
      }
      const shown = await this.maps.showStreetView(el, target);
      if (seq !== this.renderSeq) return;
      this.state.set(shown ? "ready" : "no-coverage");
    } catch (e) {
      if (seq !== this.renderSeq) return;
      this.errorMessage.set((e as Error).message);
      this.state.set("error");
    }
  }
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
