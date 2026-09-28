import { Component, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { SettingService } from "../../../core/services/setting.service";
import { GoogleMapsService, ResolvedAddress } from "../../../core/services/google-maps.service";
import { NamedLocation } from "../../../core/models/location.model";
import { RouteOptimizationSettings } from "../../../core/models/setting.model";
import { DRIVEWAY_SURFACE_OPTIONS } from "../../../core/models/driveway-surface";
import { DRIVEWAY_SIZE_OPTIONS } from "../../../core/models/driveway-size";
import { AddressAutocomplete } from "../../../shared/address-autocomplete/address-autocomplete";
import { SettingsTabs } from "./settings-tabs/settings-tabs";

/**
 * Paramètres des routes : dépôt (départ et retour par défaut ; une route peut avoir son propre
 * point d'attache) et durées de déneigement utilisées par l'optimiseur.
 */
@Component({
  selector: "app-routes-settings",
  imports: [FormsModule, SettingsTabs, AddressAutocomplete],
  templateUrl: "./routes-settings.html"
})
export class RoutesSettings implements OnInit {
  private readonly settingService = inject(SettingService);
  readonly mapsEnabled = inject(GoogleMapsService).isEnabled;

  readonly depot = signal<NamedLocation | null>(null);
  readonly updatedAt = signal<string | null>(null);
  readonly pending = signal<NamedLocation | null>(null);
  readonly loaded = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);

  readonly surfaceRows = [...DRIVEWAY_SURFACE_OPTIONS, { value: "unknown", label: "Non précisé" }];
  readonly sizeRows = DRIVEWAY_SIZE_OPTIONS;
  optimization: RouteOptimizationSettings | null = null;
  private optimizationDefaults: RouteOptimizationSettings | null = null;
  readonly optimizationUpdatedAt = signal<string | null>(null);
  readonly savingOptimization = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      const [response, optimization] = await Promise.all([this.settingService.getRouteDepot(), this.settingService.getRouteOptimizationSettings()]);
      this.depot.set(response.value);
      this.updatedAt.set(response.updatedAt);
      this.setOptimization(optimization.values, optimization.defaults, optimization.updatedAt);
      this.loaded.set(true);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  onSelected(resolved: ResolvedAddress): void {
    this.info.set(null);
    this.pending.set({
      label: `${resolved.CivicNumber} ${resolved.Street}, ${resolved.City}`.trim(),
      placeId: resolved.PlaceId,
      latitude: resolved.Latitude,
      longitude: resolved.Longitude
    });
  }

  private setOptimization(values: RouteOptimizationSettings, defaults: RouteOptimizationSettings, updatedAt: string | null): void {
    this.optimization = structuredClone(values);
    this.optimizationDefaults = defaults;
    this.optimizationUpdatedAt.set(updatedAt);
  }

  /** Exemple parlant : ce que dure une entrée de gravier double avec les valeurs saisies. */
  exampleMinutes(surface: string, size: string): number {
    const o = this.optimization;
    return o ? Math.round(Number(o.visitMinutesBySurface[surface]) * Number(o.sizeFactors[size]) * 10) / 10 : 0;
  }

  resetOptimization(): void {
    if (this.optimizationDefaults) this.optimization = structuredClone(this.optimizationDefaults);
  }

  async saveOptimization(): Promise<void> {
    if (!this.optimization) return;
    this.savingOptimization.set(true);
    this.error.set(null);
    this.info.set(null);
    try {
      const response = await this.settingService.updateRouteOptimizationSettings(this.optimization);
      this.setOptimization(response.values, response.defaults, response.updatedAt);
      this.info.set("Durées de déneigement enregistrées. Elles s'appliquent à la prochaine optimisation.");
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.savingOptimization.set(false);
    }
  }

  async save(): Promise<void> {
    const pending = this.pending();
    if (!pending) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const response = await this.settingService.updateRouteDepot(pending);
      this.depot.set(response.value);
      this.updatedAt.set(response.updatedAt);
      this.pending.set(null);
      this.info.set("Dépôt enregistré.");
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
