import { Component, computed, DestroyRef, effect, inject, OnInit, signal } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from "@angular/cdk/drag-drop";
import { RouteService } from "../../../core/services/route.service";
import { SettingService } from "../../../core/services/setting.service";
import { ServiceAddressService } from "../../../core/services/service-address.service";
import { DrivingRoute, GoogleMapsService, LatLng, ResolvedAddress } from "../../../core/services/google-maps.service";
import { Contract, ContractStatus, RouteModel, ServiceAddress } from "../../../core/models/domain.model";
import { haversineKm, isGoogleLocationStale, NamedLocation, OptimizationProposal } from "../../../core/models/location.model";
import { AddressAutocomplete } from "../../../shared/address-autocomplete/address-autocomplete";
import { RouteOptimizationSettings } from "../../../core/models/setting.model";
import { PinMove, RouteMap, RouteMapEndpoint, RouteMapStop } from "./route-map/route-map";
import { OptimizationProposalPanel } from "./optimization-proposal/optimization-proposal";

/** Contrats qui font partie de la tournée (actifs) ou le feront (brouillons, ex. après le roulement). */
const ORDERABLE_STATUSES: ContractStatus[] = ["active", "draft"];

const STATUS_LABELS: Record<ContractStatus, string> = {
  draft: "Brouillon",
  active: "Actif",
  completed: "Terminé",
  cancelled: "Annulé"
};

const toNumber = (value: number | string | null | undefined): number | null =>
  value === null || value === undefined || value === "" ? null : Number(value);

const hasCoordinates = (address: ServiceAddress | undefined): address is ServiceAddress =>
  !!address && toNumber(address.Latitude) !== null && toNumber(address.Longitude) !== null;

/** Délai avant de recalculer le trajet routier après un réordonnancement (évite une requête par glisser). */
const ROAD_DEBOUNCE_MS = 1200;

type RoadState = { status: "loading" } | { status: "ready"; route: DrivingRoute } | { status: "error"; message: string };

/** Départ → arrêts localisés (dans l'ordre) → retour. */
const tourPoints = (contracts: Contract[], endpoint: { lat: number; lng: number } | null): LatLng[] => {
  const stops = contracts
    .filter((c) => hasCoordinates(c.ServiceAddress))
    .map((c) => ({ lat: Number(c.ServiceAddress!.Latitude), lng: Number(c.ServiceAddress!.Longitude) }));
  return endpoint && stops.length ? [endpoint, ...stops, endpoint] : stops;
};

const pointsKey = (points: LatLng[]): string => points.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join(";");

const straightKm = (points: LatLng[]): number => {
  let km = 0;
  for (let i = 1; i < points.length; i++) km += haversineKm(points[i - 1], points[i]);
  return km;
};

const labelFromResolved = (r: ResolvedAddress): string => `${r.CivicNumber} ${r.Street}, ${r.City}`.trim();

/**
 * Ordre de passage d'une route (admin) : glisser-déposer ou position directe, carte des arrêts,
 * point d'attache du véhicule, correction des pins. L'opérateur suit cet ordre, figé au démarrage.
 */
@Component({
  selector: "app-route-detail",
  imports: [RouterLink, CdkDropList, CdkDrag, CdkDragHandle, RouteMap, AddressAutocomplete, OptimizationProposalPanel],
  templateUrl: "./route-detail.html",
  styleUrl: "./route-detail.scss"
})
export class RouteDetail implements OnInit {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly routeService = inject(RouteService);
  private readonly settingService = inject(SettingService);
  private readonly addressService = inject(ServiceAddressService);
  private readonly maps = inject(GoogleMapsService);

  readonly mapsEnabled = this.maps.isEnabled;
  readonly statusLabels = STATUS_LABELS;

  readonly route = signal<RouteModel | null>(null);
  readonly depot = signal<NamedLocation | null>(null);
  /** Durées de déneigement et heure de départ (Paramètres › Routes). */
  readonly optimizationSettings = signal<RouteOptimizationSettings | null>(null);
  private readonly allContracts = signal<Contract[]>([]);
  readonly season = signal<number | null>(null);
  /** Liste de travail (non enregistrée tant que `dirty`). */
  readonly order = signal<Contract[]>([]);
  readonly dirty = signal(false);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);
  readonly highlightedId = signal<number | null>(null);
  readonly pinEditMode = signal(false);
  readonly baseEditorOpen = signal(false);
  readonly pendingBase = signal<NamedLocation | null>(null);
  readonly locating = signal(false);
  readonly optimizing = signal(false);
  /** Proposition affichée (liste + carte) tant qu'elle n'est ni appliquée ni annulée. */
  readonly proposal = signal<OptimizationProposal | null>(null);
  /** Ordre exact proposé : s'il est modifié à la main, on l'enregistre comme ordre manuel. */
  private proposalKey = "";

  private readonly orderKey = computed(() => this.order().map((c) => c.Id).join(","));
  readonly proposalEdited = computed(() => this.proposal() !== null && this.orderKey() !== this.proposalKey);

  /** Ordre enregistré de la saison (référence pendant l'aperçu). */
  private readonly savedOrder = computed(() => {
    const season = this.season();
    return this.allContracts().filter((c) => c.SeasonStartYear === season && ORDERABLE_STATUSES.includes(c.Status));
  });

  private readonly endpointPoint = computed<LatLng | null>(() => {
    const e = this.mapEndpoint();
    return e ? { lat: e.lat, lng: e.lng } : null;
  });
  readonly currentPoints = computed(() => tourPoints(this.order(), this.endpointPoint()));
  private readonly savedPoints = computed(() => tourPoints(this.savedOrder(), this.endpointPoint()));

  /* ---- Deux mesures : 🐦 vol d'oiseau (calcul local, gratuit) et 🚜 trajet routier (Google Routes API) ---- */
  readonly showRoad = signal(true);
  readonly showStraight = signal(true);
  /** Cache par suite de points : revenir à un ordre déjà vu ne coûte aucune requête. */
  private readonly roadCache = signal<Record<string, RoadState>>({});
  private readonly roadFor = (points: LatLng[]): RoadState | null => (points.length > 1 ? (this.roadCache()[pointsKey(points)] ?? null) : null);
  readonly currentRoad = computed(() => this.roadFor(this.currentPoints()));
  readonly savedRoad = computed(() => this.roadFor(this.savedPoints()));
  readonly roadPath = computed(() => {
    const road = this.currentRoad();
    return road?.status === "ready" ? road.route.path : null;
  });

  /** Pendant l'aperçu : l'ordre enregistré en pointillé (son trajet routier s'il est connu et affiché, sinon à vol d'oiseau). */
  readonly comparePath = computed(() => {
    if (!this.proposal()) return null;
    const saved = this.savedRoad();
    return this.showRoad() && saved?.status === "ready" ? saved.route.path : this.savedPoints();
  });
  readonly savedStraightKm = computed(() => straightKm(this.savedPoints()));


  readonly seasons = computed(() =>
    [...new Set(this.allContracts().filter((c) => ORDERABLE_STATUSES.includes(c.Status)).map((c) => c.SeasonStartYear))].sort((a, b) => b - a)
  );

  /** Départ et retour : point d'attache de la route, sinon dépôt. */
  readonly endpoint = computed<(NamedLocation & { kind: "base" | "depot" }) | null>(() => {
    const base = this.route()?.BaseLocation;
    if (base) return { ...base, kind: "base" };
    const depot = this.depot();
    return depot ? { ...depot, kind: "depot" } : null;
  });

  readonly mapEndpoint = computed<RouteMapEndpoint | null>(() => {
    const e = this.endpoint();
    return e ? { label: e.label, lat: e.latitude, lng: e.longitude } : null;
  });

  readonly mapStops = computed<RouteMapStop[]>(() =>
    this.order().flatMap((c, index) => {
      const a = c.ServiceAddress;
      if (!hasCoordinates(a)) return [];
      return [{
        id: c.Id,
        number: index + 1,
        label: this.addressLabel(c),
        lat: Number(a.Latitude),
        lng: Number(a.Longitude),
        manual: a.LocationSource === "manual_pin"
      }];
    })
  );

  readonly unplacedCount = computed(() => this.order().filter((c) => c.RouteSequence == null).length);
  /** Adresses sans coordonnées, ou coordonnées Google expirées sans PlaceId pour les rafraîchir. */
  readonly needsLocating = computed(() =>
    this.order().filter((c) => {
      const a = c.ServiceAddress;
      if (!a) return false;
      if (!hasCoordinates(a)) return true;
      return !a.PlaceId && isGoogleLocationStale(a.LocationSource, a.LocationUpdatedAt);
    })
  );

  /** Distance à vol d'oiseau départ → arrêts → retour : repère pour comparer deux ordres, pas un kilométrage routier. */
  readonly straightLineKm = computed(() => straightKm(this.currentPoints()));

  private routeId!: number;

  constructor() {
    // Trajet routier de l'ordre affiché (et de l'ordre enregistré pendant un aperçu), recalculé après une pause
    let timer: ReturnType<typeof setTimeout> | undefined;
    effect(() => {
      const wanted = [this.currentPoints(), ...(this.proposal() ? [this.savedPoints()] : [])];
      clearTimeout(timer);
      if (!this.mapsEnabled) return;
      timer = setTimeout(() => wanted.forEach((points) => void this.ensureRoad(points)), ROAD_DEBOUNCE_MS);
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  }

  private async ensureRoad(points: LatLng[]): Promise<void> {
    if (points.length < 2) return;
    const key = pointsKey(points);
    const existing = this.roadCache()[key];
    if (existing && existing.status !== "error") return;
    this.roadCache.update((cache) => ({ ...cache, [key]: { status: "loading" } }));
    let state: RoadState;
    try {
      state = { status: "ready", route: await this.maps.computeDrivingRoute(points) };
    } catch (e) {
      state = { status: "error", message: (e as Error).message };
    }
    this.roadCache.update((cache) => ({ ...cache, [key]: state }));
  }

  /** Minutes de déneigement de l'ordre affiché : revêtement × taille (mêmes règles que l'optimiseur). */
  readonly visitMinutes = computed(() => {
    const settings = this.optimizationSettings();
    if (!settings) return null;
    const seconds = this.order().reduce((sum, c) => {
      const a = c.ServiceAddress;
      const minutes = settings.visitMinutesBySurface[a?.DrivewaySurface ?? "unknown"] ?? settings.visitMinutesBySurface["unknown"];
      const factor = settings.sizeFactors[a?.DrivewaySize ?? "single"] ?? 1;
      return sum + Math.round(minutes * factor * 60);
    }, 0);
    return Math.round(seconds / 60);
  });

  /** Heure de retour estimée : départ + route (Google) + déneigement. Null tant que le trajet routier n'est pas connu. */
  readonly returnTime = computed(() => {
    const settings = this.optimizationSettings();
    const road = this.currentRoad();
    const visits = this.visitMinutes();
    if (!settings || road?.status !== "ready" || visits === null) return null;
    const [h, m] = settings.departureTime.split(":").map(Number);
    const total = h * 60 + m + Math.round(road.route.durationSeconds / 60) + visits;
    return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  });

  roadKm(state: RoadState | null): number | null {
    return state?.status === "ready" ? state.route.distanceMeters / 1000 : null;
  }

  roadMinutes(state: RoadState | null): number | null {
    return state?.status === "ready" ? Math.round(state.route.durationSeconds / 60) : null;
  }

  roadError(state: RoadState | null): string | null {
    return state?.status === "error" ? state.message : null;
  }

  async ngOnInit(): Promise<void> {
    this.routeId = Number(this.activatedRoute.snapshot.paramMap.get("id"));
    await this.load();
    void this.refreshStaleLocations();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [route, contracts, depot, optimization] = await Promise.all([
        this.routeService.getRoute(this.routeId),
        this.routeService.getRouteContracts(this.routeId),
        this.settingService.getRouteDepot(),
        this.settingService.getRouteOptimizationSettings()
      ]);
      this.route.set(route);
      this.depot.set(depot.value);
      this.optimizationSettings.set(optimization.values);
      this.allContracts.set(contracts);
      if (this.season() === null || !this.seasons().includes(this.season()!)) {
        this.season.set(this.defaultSeason(contracts));
      }
      this.resetOrder();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  /** Saison qui roule en ce moment (le plus de contrats actifs), sinon la plus récente. */
  private defaultSeason(contracts: Contract[]): number | null {
    const active = new Map<number, number>();
    for (const c of contracts) if (c.Status === "active") active.set(c.SeasonStartYear, (active.get(c.SeasonStartYear) ?? 0) + 1);
    if (active.size) return [...active.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
    return this.seasons()[0] ?? null;
  }

  /** L'API renvoie déjà l'ordre de passage (placés, puis « à placer »). */
  resetOrder(): void {
    this.order.set(this.savedOrder());
    this.dirty.set(false);
    this.proposal.set(null);
    this.proposalKey = "";
  }

  /**
   * Demande une proposition au serveur et l'affiche à la place de l'ordre courant (non enregistrée).
   * Les arrêts que l'optimiseur n'a pas pu placer restent à la fin, dans leur ordre actuel.
   */
  async optimize(): Promise<void> {
    const season = this.season();
    if (season === null) return;
    if (this.dirty() && !this.proposal() && !confirm("L'ordre modifié n'est pas enregistré. Le remplacer par la proposition de l'optimiseur ?")) return;
    this.optimizing.set(true);
    this.error.set(null);
    this.info.set(null);
    try {
      const proposal = await this.routeService.optimize(this.routeId, season);
      if (proposal.validateOnly) {
        this.info.set("Requête validée par Google (mode VALIDATE_ONLY) : aucun ordre calculé, rien de facturé.");
        return;
      }
      const byId = new Map(this.savedOrder().map((c) => [c.Id, c]));
      const placed = proposal.orderedContractIds.map((id) => byId.get(id)).filter((c): c is Contract => !!c);
      const placedIds = new Set(placed.map((c) => c.Id));
      const rest = this.savedOrder().filter((c) => !placedIds.has(c.Id));
      const next = [...placed, ...rest];
      this.order.set(next);
      this.proposal.set(proposal);
      this.proposalKey = next.map((c) => c.Id).join(",");
      this.dirty.set(true);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.optimizing.set(false);
    }
  }

  selectSeason(value: string): void {
    if (this.dirty() && !confirm("Abandonner l'ordre non enregistré ?")) return;
    this.season.set(Number(value));
    this.resetOrder();
  }

  drop(event: CdkDragDrop<Contract[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const list = [...this.order()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.order.set(list);
    this.dirty.set(true);
  }

  /** Saisie directe de la position : plus rapide que glisser sur une route de 100 arrêts. */
  moveTo(index: number, position: number, input?: HTMLInputElement): void {
    const list = [...this.order()];
    const target = Math.min(Math.max(Math.round(position) || 1, 1), list.length) - 1;
    if (target !== index) {
      moveItemInArray(list, index, target);
      this.order.set(list);
      this.dirty.set(true);
    } else if (input) {
      input.value = String(index + 1);
    }
  }

  reverse(): void {
    this.order.set([...this.order()].reverse());
    this.dirty.set(true);
  }

  async saveOrder(): Promise<void> {
    const ids = this.order().map((c) => c.Id);
    if (!ids.length) return;
    this.saving.set(true);
    this.error.set(null);
    this.info.set(null);
    // Proposition gardée telle quelle → tracée « ordre optimisé » ; retouchée → ordre manuel
    const optimized = this.proposal() !== null && !this.proposalEdited();
    try {
      const { route, contracts } = optimized
        ? await this.routeService.applyOptimization(this.routeId, ids)
        : await this.routeService.updateSequence(this.routeId, ids);
      this.route.set(route);
      this.allContracts.set(contracts);
      this.resetOrder();
      this.info.set(`${optimized ? "Ordre optimisé" : "Ordre"} enregistré (${ids.length} arrêts). Il s'appliquera à la prochaine tournée démarrée.`);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  cancelOrder(): void {
    this.resetOrder();
  }

  /** Aucun départ/retour → l'optimiseur refuserait. */
  readonly canOptimize = computed(() => this.endpoint() !== null && this.order().length >= 2);

  /** Garde de sortie (route Angular) : ne pas perdre un réordonnancement de 100 arrêts. */
  confirmLeave(): boolean {
    return !this.dirty() || confirm("L'ordre modifié n'est pas enregistré. Quitter quand même ?");
  }

  /* ---------------- Point d'attache ---------------- */

  onBaseSelected(resolved: ResolvedAddress): void {
    this.pendingBase.set({ label: labelFromResolved(resolved), placeId: resolved.PlaceId, latitude: resolved.Latitude, longitude: resolved.Longitude });
  }

  async saveBase(base: NamedLocation | null): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      this.route.set(await this.routeService.updateRoute(this.routeId, { BaseLocation: base }));
      this.baseEditorOpen.set(false);
      this.pendingBase.set(null);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  /* ---------------- Coordonnées ---------------- */

  private patchAddress(updated: ServiceAddress): void {
    const patch = (list: Contract[]) => list.map((c) => (c.ServiceAddressId === updated.Id ? { ...c, ServiceAddress: { ...c.ServiceAddress, ...updated } } : c));
    this.allContracts.update(patch);
    this.order.update(patch);
  }

  /**
   * Conditions Google : les coordonnées Places ne se gardent que temporairement, seul le PlaceId est permanent.
   * À l'ouverture, on redemande par PlaceId celles qui ont expiré (Place Details « location », palier gratuit).
   */
  private async refreshStaleLocations(): Promise<void> {
    if (!this.maps.isEnabled) return;
    let refreshed = 0;
    try {
      await this.refreshNamedLocation();
      const seen = new Set<number>();
      for (const contract of this.allContracts()) {
        const a = contract.ServiceAddress;
        if (!a?.PlaceId || seen.has(a.Id) || !isGoogleLocationStale(a.LocationSource, a.LocationUpdatedAt)) continue;
        seen.add(a.Id);
        const location = await this.maps.fetchLocation(a.PlaceId);
        if (!location) continue;
        this.patchAddress(await this.addressService.updateAddress(a.Id, { Latitude: location.lat, Longitude: location.lng, LocationSource: "google_places" }));
        refreshed++;
      }
    } catch (e) {
      this.error.set(`Rafraîchissement des coordonnées interrompu : ${(e as Error).message}`);
    }
    if (refreshed) this.info.set(`${refreshed} coordonnée(s) Google rafraîchie(s).`);
  }

  private async refreshNamedLocation(): Promise<void> {
    const base = this.route()?.BaseLocation;
    if (base?.placeId && isGoogleLocationStale("google_places", base.locationUpdatedAt)) {
      const location = await this.maps.fetchLocation(base.placeId);
      if (location) this.route.set(await this.routeService.updateRoute(this.routeId, { BaseLocation: { ...base, latitude: location.lat, longitude: location.lng } }));
    }
    const depot = this.depot();
    if (depot?.placeId && isGoogleLocationStale("google_places", depot.locationUpdatedAt)) {
      const location = await this.maps.fetchLocation(depot.placeId);
      if (location) this.depot.set((await this.settingService.updateRouteDepot({ ...depot, latitude: location.lat, longitude: location.lng })).value);
    }
  }

  /** Adresses sans coordonnées ou sans PlaceId : recherche Google par texte (facturée, sur demande seulement). */
  async locateMissing(): Promise<void> {
    const targets = this.needsLocating();
    if (!targets.length || !confirm(`Localiser ${targets.length} adresse(s) avec Google ?`)) return;
    this.locating.set(true);
    this.error.set(null);
    const notFound: string[] = [];
    try {
      for (const contract of targets) {
        const a = contract.ServiceAddress!;
        const found = await this.maps.geocode(`${a.CivicNumber} ${a.Street}, ${a.City}, QC ${a.PostalCode}`);
        if (!found) {
          notFound.push(this.addressLabel(contract));
          continue;
        }
        this.patchAddress(await this.addressService.updateAddress(a.Id, { Latitude: found.lat, Longitude: found.lng, PlaceId: found.placeId, LocationSource: "google_places" }));
      }
      this.info.set(notFound.length ? `Introuvable(s) : ${notFound.join(" ; ")}. Corrigez l'adresse ou placez le pin à la main.` : "Adresses localisées.");
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.locating.set(false);
    }
  }

  /** Pin déplacé à la main : notre propre donnée (rang, entrée loin de la rue), n'expire pas. */
  async onPinMoved(move: PinMove): Promise<void> {
    const contract = this.order().find((c) => c.Id === move.id);
    const address = contract?.ServiceAddress;
    if (!contract || !address) return;
    if (!confirm(`Déplacer le pin de ${this.addressLabel(contract)} ici ?`)) {
      this.order.set([...this.order()]); // redessine au bon endroit
      return;
    }
    try {
      this.patchAddress(await this.addressService.updateAddress(address.Id, { Latitude: move.lat, Longitude: move.lng, LocationSource: "manual_pin" }));
      this.info.set(`Pin corrigé : ${this.addressLabel(contract)}.`);
    } catch (e) {
      this.error.set((e as Error).message);
      this.order.set([...this.order()]);
    }
  }

  focusStop(id: number): void {
    this.highlightedId.set(id);
    document.getElementById(`stop-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  /* ---------------- Libellés ---------------- */

  clientLabel(contract: Contract): string {
    const client = contract.Client;
    if (!client) return "—";
    const person = [client.FirstName, client.LastName].filter(Boolean).join(" ");
    return client.CompanyName || person || `#${client.ClientNumber}`;
  }

  addressLabel(contract: Contract): string {
    const a = contract.ServiceAddress;
    return a ? `${a.CivicNumber} ${a.Street}, ${a.City}` : "—";
  }

  hasCoordinates(contract: Contract): boolean {
    return hasCoordinates(contract.ServiceAddress);
  }

  sequenceLabel(route: RouteModel): string {
    if (!route.SequenceUpdatedAt) return "Ordre jamais défini";
    const by = route.SequenceUpdatedBy?.Name || route.SequenceUpdatedBy?.Email;
    const source = route.SequenceSource === "optimized" ? "Ordre optimisé" : "Ordre manuel";
    return `${source} le ${route.SequenceUpdatedAt.slice(0, 10)}${by ? ` par ${by}` : ""}`;
  }
}
