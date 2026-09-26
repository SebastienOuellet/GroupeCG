import { Component, DestroyRef, inject, output, signal } from "@angular/core";
import { AddressSuggestion, GoogleMapsService, ResolvedAddress } from "../../core/services/google-maps.service";

const DEBOUNCE_MS = 250;
const MIN_CHARS = 3;

/**
 * Champ de recherche d'adresse Google (Places API New). Émet `selected` avec l'adresse
 * décomposée + coordonnées ; le parent remplit ses propres champs, qui restent modifiables.
 * Ne s'affiche pas si la clé Google Maps n'est pas configurée.
 */
@Component({
  selector: "app-address-autocomplete",
  templateUrl: "./address-autocomplete.html",
  styleUrl: "./address-autocomplete.scss"
})
export class AddressAutocomplete {
  private readonly maps = inject(GoogleMapsService);

  readonly selected = output<ResolvedAddress>();

  readonly enabled = this.maps.isEnabled;
  readonly query = signal("");
  readonly suggestions = signal<AddressSuggestion[]>([]);
  readonly activeIndex = signal(-1);
  readonly open = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  /** Ignore les réponses arrivées après une frappe plus récente. */
  private requestSeq = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.debounceTimer));
  }

  onInput(value: string): void {
    this.query.set(value);
    this.error.set(null);
    clearTimeout(this.debounceTimer);

    if (value.trim().length < MIN_CHARS) {
      this.suggestions.set([]);
      this.open.set(false);
      return;
    }
    this.debounceTimer = setTimeout(() => this.search(value.trim()), DEBOUNCE_MS);
  }

  private async search(text: string): Promise<void> {
    const seq = ++this.requestSeq;
    this.loading.set(true);
    try {
      const results = await this.maps.searchAddresses(text);
      if (seq !== this.requestSeq) return;
      this.suggestions.set(results);
      this.activeIndex.set(results.length ? 0 : -1);
      this.open.set(true);
    } catch (e) {
      if (seq !== this.requestSeq) return;
      this.error.set(`Recherche Google indisponible : ${(e as Error).message}`);
      this.open.set(false);
    } finally {
      if (seq === this.requestSeq) this.loading.set(false);
    }
  }

  onKeydown(event: KeyboardEvent): void {
    const list = this.suggestions();
    if (!this.open() || list.length === 0) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        this.activeIndex.update((i) => (i + 1) % list.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        this.activeIndex.update((i) => (i <= 0 ? list.length - 1 : i - 1));
        break;
      case "Enter":
        // Empêche la soumission du formulaire parent pendant la sélection
        event.preventDefault();
        if (this.activeIndex() >= 0) void this.choose(list[this.activeIndex()]);
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation(); // ne pas fermer un <dialog> parent
        this.cancelPending();
        this.open.set(false);
        break;
    }
  }

  onBlur(): void {
    // Délai : laisse le temps au pointerdown sur une suggestion d'être traité
    setTimeout(() => {
      this.cancelPending();
      this.open.set(false);
    }, 150);
  }

  /** Annule la recherche en attente : sinon une réponse tardive rouvrirait la liste. */
  private cancelPending(): void {
    clearTimeout(this.debounceTimer);
    this.requestSeq++;
    this.loading.set(false);
  }

  async choose(suggestion: AddressSuggestion): Promise<void> {
    this.open.set(false);
    this.loading.set(true);
    this.error.set(null);
    try {
      const address = await this.maps.resolveSuggestion(suggestion);
      this.query.set(`${suggestion.mainText}, ${suggestion.secondaryText}`);
      this.selected.emit(address);
    } catch (e) {
      this.error.set(`Impossible d'obtenir le détail de l'adresse : ${(e as Error).message}`);
    } finally {
      this.loading.set(false);
    }
  }
}
