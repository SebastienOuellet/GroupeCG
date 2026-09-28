import { DestroyRef, inject, Injectable, signal } from "@angular/core";
import { TrackingService } from "./tracking.service";
import { BrowserPosition } from "../models/tracking.model";

/** Envoi groupé : moins de requêtes et de batterie qu'une requête par position. */
const FLUSH_MS = 15_000;
/** Positions trop imprécises (intérieur, démarrage du GPS) : inutiles sur la carte. */
const MAX_ACCURACY_M = 100;
/** Tampon gardé si le réseau manque (zone morte) : ~30 min à une position aux 5 s. */
const MAX_BUFFER = 400;
const STORAGE_PREFIX = "gcg-phone-gps-run-";

/**
 * GPS du téléphone de l'opérateur, en repli quand le tracteur n'a pas d'appareil.
 * Limite d'une page web : le navigateur coupe le GPS dès que la page passe en arrière-plan
 * (écran verrouillé, ouverture de « Naviguer »). On garde l'écran allumé (Wake Lock) tant
 * que le suivi est actif ; pour un suivi fiable, Traccar Client dans le tracteur.
 */
@Injectable({ providedIn: "root" })
export class PhoneGpsService {
  private readonly tracking = inject(TrackingService);

  readonly active = signal(false);
  readonly lastFixAt = signal<Date | null>(null);
  /** Dernière position de ce téléphone (carte de l'opérateur, sans attendre le serveur). */
  readonly lastFix = signal<{ lat: number; lng: number; heading: number | null; at: Date } | null>(null);
  readonly lastSentAt = signal<Date | null>(null);
  readonly error = signal<string | null>(null);
  readonly supported = typeof navigator !== "undefined" && "geolocation" in navigator;

  private runId: number | null = null;
  private watchId: number | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private buffer: BrowserPosition[] = [];
  private sending = false;
  private wakeLock: WakeLockSentinel | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** Le suivi était-il actif pour cette tournée (rechargement de la page) ? */
  wasEnabledFor(runId: number): boolean {
    try {
      return sessionStorage.getItem(STORAGE_PREFIX + runId) === "1";
    } catch {
      return false;
    }
  }

  start(runId: number): void {
    if (!this.supported) {
      this.error.set("Ce navigateur ne donne pas accès au GPS.");
      return;
    }
    if (this.active() && this.runId === runId) return;
    this.stop();
    this.runId = runId;
    this.error.set(null);
    this.active.set(true);
    this.remember(runId, true);

    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.onPosition(position),
      (error) => this.onError(error),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
    this.timer = setInterval(() => void this.flush(), FLUSH_MS);
    void this.requestWakeLock();
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  /** Arrêt volontaire (case décochée, fin de tournée) : on envoie ce qui reste. */
  stop(forget = false): void {
    if (this.runId !== null && forget) this.remember(this.runId, false);
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    document.removeEventListener("visibilitychange", this.onVisibility);
    void this.wakeLock?.release().catch(() => undefined);
    this.wakeLock = null;
    if (this.active()) void this.flush();
    this.active.set(false);
  }

  private onPosition(position: GeolocationPosition): void {
    const { latitude, longitude, accuracy, speed, heading } = position.coords;
    this.lastFixAt.set(new Date(position.timestamp));
    this.lastFix.set({ lat: latitude, lng: longitude, heading: heading == null || Number.isNaN(heading) ? null : heading, at: new Date(position.timestamp) });
    this.error.set(null);
    if (accuracy > MAX_ACCURACY_M) return;
    this.buffer.push({
      latitude,
      longitude,
      accuracyM: accuracy,
      speedKmh: speed == null || Number.isNaN(speed) ? null : speed * 3.6,
      heading: heading == null || Number.isNaN(heading) ? null : heading,
      recordedAt: new Date(position.timestamp).toISOString()
    });
    if (this.buffer.length > MAX_BUFFER) this.buffer.splice(0, this.buffer.length - MAX_BUFFER);
  }

  private onError(error: GeolocationPositionError): void {
    if (error.code === error.PERMISSION_DENIED) {
      this.error.set("Accès à la position refusé. Autorisez la localisation pour ce site dans les réglages du navigateur.");
      this.stop(true);
    } else if (error.code === error.POSITION_UNAVAILABLE) {
      this.error.set("Position GPS indisponible pour le moment.");
    }
    // TIMEOUT : le GPS cherche encore, watchPosition réessaie tout seul
  }

  private async flush(): Promise<void> {
    if (this.sending || this.buffer.length === 0 || this.runId === null) return;
    this.sending = true;
    const batch = this.buffer.splice(0, this.buffer.length);
    try {
      await this.tracking.sendPositions(this.runId, batch);
      this.lastSentAt.set(new Date());
    } catch (e) {
      const message = (e as Error).message;
      if (/pas en cours|introuvable|assignée/i.test(message)) {
        // Tournée terminée ailleurs ou droits retirés : inutile d'insister
        this.error.set(message);
        this.stop(true);
      } else {
        // Réseau : on remet en tête du tampon pour le prochain envoi
        this.buffer.unshift(...batch.slice(-MAX_BUFFER));
      }
    } finally {
      this.sending = false;
    }
  }

  private async requestWakeLock(): Promise<void> {
    try {
      this.wakeLock = (await navigator.wakeLock?.request("screen")) ?? null;
    } catch {
      this.wakeLock = null; // Économie d'énergie ou navigateur sans Wake Lock : l'écran peut s'éteindre
    }
  }

  /** Le verrou d'écran saute quand la page est cachée : on le reprend au retour. */
  private readonly onVisibility = (): void => {
    if (!document.hidden && this.active()) {
      void this.requestWakeLock();
      void this.flush();
    }
  };

  private remember(runId: number, enabled: boolean): void {
    try {
      if (enabled) sessionStorage.setItem(STORAGE_PREFIX + runId, "1");
      else sessionStorage.removeItem(STORAGE_PREFIX + runId);
    } catch {
      /* stockage indisponible (navigation privée) : pas grave */
    }
  }
}
