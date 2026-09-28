import { Component, inject, OnInit, signal } from "@angular/core";
import { SettingService } from "../../../core/services/setting.service";
import { GoogleMapsService, ResolvedAddress } from "../../../core/services/google-maps.service";
import { NamedLocation } from "../../../core/models/location.model";
import { AddressAutocomplete } from "../../../shared/address-autocomplete/address-autocomplete";
import { SettingsTabs } from "./settings-tabs/settings-tabs";

/** Dépôt des routes : départ et retour par défaut (une route peut avoir son propre point d'attache). */
@Component({
  selector: "app-routes-settings",
  imports: [SettingsTabs, AddressAutocomplete],
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

  async ngOnInit(): Promise<void> {
    try {
      const response = await this.settingService.getRouteDepot();
      this.depot.set(response.value);
      this.updatedAt.set(response.updatedAt);
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
