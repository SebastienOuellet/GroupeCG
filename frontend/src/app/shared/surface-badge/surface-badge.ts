import { Component, computed, input } from "@angular/core";
import { DRIVEWAY_SURFACE_LABELS, DrivewaySurface } from "../../core/models/driveway-surface";

/** Pastille colorée du revêtement de l'entrée. N'affiche rien si non précisé. */
@Component({
  selector: "app-surface-badge",
  template: `@if (surface(); as s) {
    <span class="surface-badge surface-badge--{{ s }}">{{ label() }}</span>
  }`
})
export class SurfaceBadge {
  readonly surface = input<DrivewaySurface | null | undefined>(null);
  readonly label = computed(() => {
    const s = this.surface();
    return s ? DRIVEWAY_SURFACE_LABELS[s] : "";
  });
}
