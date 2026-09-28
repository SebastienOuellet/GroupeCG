import { Component, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { VehicleService } from "../../../core/services/vehicle.service";
import { Vehicle, VehicleInput } from "../../../core/models/vehicle.model";
import { timeAgo } from "../../../core/utils/time-ago";
import { SettingsTabs } from "./settings-tabs/settings-tabs";
import { SettingService } from "../../../core/services/setting.service";
import { TrackingSettings } from "../../../core/models/setting.model";

/** Jeton tout juste généré : montré une seule fois avec les réglages à copier dans Traccar Client. */
interface TokenNotice {
  vehicleName: string;
  token: string;
}

/**
 * Tracteurs suivis par GPS : un appareil par tracteur (téléphone avec Traccar Client, ou
 * ESP32 cellulaire) qui envoie ses positions avec un jeton propre au véhicule.
 */
@Component({
  selector: "app-vehicles-settings",
  imports: [FormsModule, SettingsTabs],
  templateUrl: "./vehicles-settings.html"
})
export class VehiclesSettings implements OnInit {
  private readonly vehicleService = inject(VehicleService);
  private readonly settingService = inject(SettingService);

  readonly vehicles = signal<Vehicle[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly showForm = signal(false);
  readonly saving = signal(false);
  readonly tokenNotice = signal<TokenNotice | null>(null);
  readonly copied = signal<string | null>(null);
  readonly showInactive = signal(false);

  readonly serverUrl = this.vehicleService.serverUrl;
  /** Une URL localhost n'est pas joignable depuis le téléphone du tracteur. */
  readonly serverUrlIsLocal = /\/\/(localhost|127\.|10\.|192\.168\.)/.test(this.serverUrl);
  readonly timeAgo = timeAgo;

  form: VehicleInput & { Id?: number } = { Name: "" };

  /** Réglages du suivi GPS (géorepérage, conservation). */
  tracking: TrackingSettings | null = null;
  private trackingDefaults: TrackingSettings | null = null;
  readonly trackingUpdatedAt = signal<string | null>(null);
  readonly savingTracking = signal(false);
  readonly trackingInfo = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await Promise.all([this.load(), this.loadTracking()]);
  }

  private async loadTracking(): Promise<void> {
    try {
      const response = await this.settingService.getTrackingSettings();
      this.setTracking(response.values, response.defaults, response.updatedAt);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  private setTracking(values: TrackingSettings, defaults: TrackingSettings, updatedAt: string | null): void {
    this.tracking = { ...values };
    this.trackingDefaults = defaults;
    this.trackingUpdatedAt.set(updatedAt);
  }

  resetTracking(): void {
    if (this.trackingDefaults) this.tracking = { ...this.trackingDefaults };
  }

  async saveTracking(): Promise<void> {
    if (!this.tracking) return;
    this.savingTracking.set(true);
    this.error.set(null);
    this.trackingInfo.set(null);
    try {
      const response = await this.settingService.updateTrackingSettings(this.tracking);
      this.setTracking(response.values, response.defaults, response.updatedAt);
      this.trackingInfo.set("Réglages du suivi enregistrés. Ils s'appliquent aux prochaines positions reçues.");
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.savingTracking.set(false);
    }
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.vehicles.set(await this.vehicleService.getVehicles(this.showInactive()));
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  async toggleInactive(): Promise<void> {
    this.showInactive.set(!this.showInactive());
    await this.load();
  }

  openForm(vehicle?: Vehicle): void {
    this.form = vehicle ? { Id: vehicle.Id, Name: vehicle.Name, Notes: vehicle.Notes } : { Name: "", Notes: null };
    this.showForm.set(true);
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      const { Id, ...input } = this.form;
      if (Id) {
        await this.vehicleService.updateVehicle(Id, input);
        this.showForm.set(false);
      } else {
        const created = await this.vehicleService.createVehicle(input);
        this.showForm.set(false);
        // Un tracteur sans jeton ne sert à rien : on enchaîne
        await this.generateToken(created, false);
      }
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  async generateToken(vehicle: Vehicle, confirmReplace = true): Promise<void> {
    if (confirmReplace && vehicle.HasToken && !confirm(`Générer un nouveau jeton pour « ${vehicle.Name} » ? L'appareil actuel cessera d'envoyer ses positions tant qu'il n'aura pas le nouveau.`)) {
      return;
    }
    this.error.set(null);
    try {
      const { token } = await this.vehicleService.regenerateToken(vehicle.Id);
      this.tokenNotice.set({ vehicleName: vehicle.Name, token });
      this.copied.set(null);
      await this.load();
      setTimeout(() => document.getElementById("token-notice")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  async setActive(vehicle: Vehicle, isActive: boolean): Promise<void> {
    if (!isActive && !confirm(`Désactiver « ${vehicle.Name} » ? Ses positions seront refusées.`)) return;
    this.error.set(null);
    try {
      await this.vehicleService.updateVehicle(vehicle.Id, { IsActive: isActive });
      await this.load();
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  async copy(value: string, key: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.copied.set(key);
    } catch {
      this.copied.set(null);
    }
  }

  routeNames(vehicle: Vehicle): string {
    return (vehicle.DefaultForRoutes ?? []).map((r) => r.Name).join(", ") || "—";
  }
}
