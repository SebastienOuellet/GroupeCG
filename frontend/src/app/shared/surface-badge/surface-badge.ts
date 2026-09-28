import { Component, computed, input } from "@angular/core";
import { DRIVEWAY_SURFACE_LABELS, DrivewaySurface } from "../../core/models/driveway-surface";
import { DRIVEWAY_SIZE, DRIVEWAY_SIZE_LABELS, DrivewaySize } from "../../core/models/driveway-size";

/**
 * Pastille colorée du revêtement de l'entrée, suivie de sa taille si elle n'est pas simple
 * (l'opérateur sait qu'une entrée double ou commerciale prend plus de temps). Rien si non précisé.
 */
@Component({
  selector: "app-surface-badge",
  template: `@if (surface(); as s) {
      <span class="surface-badge surface-badge--{{ s }}">{{ label() }}</span>
    }
    @if (sizeLabel(); as sl) {
      <span class="surface-badge size-badge">{{ sl }}</span>
    }`,
  styles: `
    :host { display: inline-flex; flex-wrap: wrap; gap: 0.25rem; }
    .size-badge { background: #eef1f6; color: var(--color-primary); }
  `
})
export class SurfaceBadge {
  readonly surface = input<DrivewaySurface | null | undefined>(null);
  readonly size = input<DrivewaySize | null | undefined>(null);
  readonly label = computed(() => {
    const s = this.surface();
    return s ? DRIVEWAY_SURFACE_LABELS[s] : "";
  });
  readonly sizeLabel = computed(() => {
    const size = this.size();
    return size && size !== DRIVEWAY_SIZE.SINGLE ? `Entrée ${DRIVEWAY_SIZE_LABELS[size].toLowerCase()}` : "";
  });
}
