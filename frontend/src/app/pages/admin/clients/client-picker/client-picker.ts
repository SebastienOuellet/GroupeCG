import { Component, computed, input, model, output, signal } from "@angular/core";
import { Client } from "../../../../core/models/domain.model";

const MAX_RESULTS = 50;

/** Minuscules + sans accents : « Béland » est trouvé en tapant « beland ». */
const normalize = (value: string): string =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Champ de sélection de client avec recherche (numéro, nom, entreprise, courriel, téléphone).
 * Filtre en mémoire sur la liste reçue : instantané et suffisant pour quelques milliers de
 * clients. Liaison : [(value)]="form.ClientId".
 */
@Component({
  selector: "app-client-picker",
  templateUrl: "./client-picker.html",
  styleUrl: "./client-picker.scss"
})
export class ClientPicker {
  readonly clients = input.required<Client[]>();
  readonly inputId = input("client-picker");
  readonly value = model<number | undefined>(undefined);
  /** Clic sur « Créer un nouveau client » : émet le texte tapé pour pré-remplir la création. */
  readonly createRequested = output<string>();

  readonly query = signal("");
  readonly open = signal(false);
  readonly activeIndex = signal(0);

  private readonly searchIndex = computed(() =>
    this.clients().map((client) => ({
      client,
      haystack: normalize(
        [client.ClientNumber, client.FirstName, client.LastName, client.CompanyName, client.Email, client.Phone]
          .filter(Boolean)
          .join(" ")
      )
    }))
  );

  readonly selected = computed(() => this.clients().find((client) => client.Id === this.value()) ?? null);

  private readonly matches = computed(() => {
    const terms = normalize(this.query().trim()).split(/\s+/).filter(Boolean);
    const index = this.searchIndex();
    if (!terms.length) return index;
    const found = index.filter(({ haystack }) => terms.every((term) => haystack.includes(term)));
    // Numéro de client exact en tête (sinon noyé parmi les téléphones qui le contiennent).
    const exact = found.findIndex(({ client }) => String(client.ClientNumber) === terms[0]);
    return exact > 0 ? [found[exact], ...found.slice(0, exact), ...found.slice(exact + 1)] : found;
  });

  readonly results = computed(() => this.matches().slice(0, MAX_RESULTS).map(({ client }) => client));
  readonly hiddenCount = computed(() => this.matches().length - this.results().length);

  /** Index de l'option « Créer » : toujours la dernière de la liste. */
  readonly createIndex = computed(() => this.results().length);

  /** Texte affiché dans le champ : la recherche en cours, sinon le client choisi. */
  readonly displayText = computed(() => {
    if (this.open()) return this.query();
    const client = this.selected();
    return client ? this.label(client) : "";
  });

  label(client: Client): string {
    const person = [client.FirstName, client.LastName].filter(Boolean).join(" ");
    const name = client.CompanyName ? `${client.CompanyName}${person ? ` (${person})` : ""}` : person || "?";
    return `#${client.ClientNumber} — ${name}`;
  }

  secondary(client: Client): string {
    return [client.Phone, client.Email].filter(Boolean).join(" · ");
  }

  optionId(index: number): string {
    return `${this.inputId()}-opt-${index}`;
  }

  onFocus(): void {
    this.query.set("");
    this.activeIndex.set(0);
    this.open.set(true);
  }

  onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(0);
    this.open.set(true);
  }

  onBlur(): void {
    this.open.set(false);
  }

  onKeydown(event: KeyboardEvent): void {
    const last = this.createIndex();
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!this.open()) this.onFocus();
        else this.activeIndex.update((index) => Math.min(index + 1, last));
        break;
      case "ArrowUp":
        event.preventDefault();
        this.activeIndex.update((index) => Math.max(index - 1, 0));
        break;
      case "Enter":
        if (!this.open()) return;
        event.preventDefault(); // ne pas soumettre le formulaire de contrat
        this.choose(this.activeIndex());
        break;
      case "Escape":
        if (!this.open()) return;
        event.preventDefault();
        event.stopPropagation();
        this.close(event.target as HTMLInputElement);
        break;
    }
  }

  /** mousedown (et non click) : s'exécute avant le blur du champ. */
  onOptionMouseDown(event: MouseEvent, index: number): void {
    event.preventDefault();
    this.choose(index);
    (event.target as HTMLElement).closest(".client-picker")?.querySelector("input")?.blur();
  }

  clear(input: HTMLInputElement): void {
    this.value.set(undefined);
    input.focus();
  }

  private choose(index: number): void {
    if (index === this.createIndex()) {
      this.createRequested.emit(this.query().trim());
    } else {
      const client = this.results()[index];
      if (client && client.Id !== this.value()) this.value.set(client.Id);
    }
    this.open.set(false);
  }

  private close(input: HTMLInputElement): void {
    this.open.set(false);
    input.blur();
  }
}
