import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { RouteOptimizer } from "./RouteOptimizer.js";
import { hasCoordinates } from "./geo.js";
import { ServiceUnavailableError } from "../errors/Errors.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_DIR = path.resolve(__dirname, "../../googleConfig");

/** Poids relatifs pour le solveur : surtout minimiser les km, puis le temps. */
const COST_PER_KILOMETER = 1;
const COST_PER_HOUR = 30;
const GLOBAL_WINDOW_SECONDS = 24 * 60 * 60;

const toLatLng = (point) => ({ latitude: point.latitude, longitude: point.longitude });

/**
 * Waypoint Google : le PlaceId quand on l'a (seule donnée Google stockable, et Google
 * choisit le bon point d'accès), sinon les coordonnées. Un pin corrigé à la main passe
 * toujours par ses coordonnées : c'est justement là que Google se trompait.
 */
export const toWaypoint = (point) => {
  if (point.placeId && !point.manualPin) return { placeId: point.placeId };
  return { location: { latLng: toLatLng(point) } };
};

const secondsOf = (duration) => Number(duration?.seconds ?? 0) + Number(duration?.nanos ?? 0) / 1e9;

/**
 * Requête OptimizeTours pour 1 véhicule. Minimisation Loi 25 : seulement des lieux
 * (placeId ou lat/lng), des durées et `label = ContractId` — jamais de nom, courriel,
 * téléphone ni numéro de client. Exportée pour être inspectée par les tests.
 */
export const buildOptimizeToursRequest = ({ projectId, start, end, stops, timeoutSeconds, validateOnly = false, vehicleLabel = "route", startTime = null }) => ({
  parent: `projects/${projectId}`,
  timeout: { seconds: timeoutSeconds },
  solvingMode: validateOnly ? "VALIDATE_ONLY" : "DEFAULT_SOLVE",
  considerRoadTraffic: false,
  populatePolylines: false,
  model: {
    // Heure de départ réelle de la tournée (ex. 3 h 30) ; fenêtre de 24 h pour tout faire
    ...(startTime
      ? {
        globalStartTime: { seconds: Math.floor(startTime.getTime() / 1000) },
        globalEndTime: { seconds: Math.floor(startTime.getTime() / 1000) + GLOBAL_WINDOW_SECONDS }
      }
      : {}),
    shipments: stops.map((stop) => ({
      label: String(stop.id),
      deliveries: [{ arrivalWaypoint: toWaypoint(stop), duration: { seconds: stop.visitSeconds ?? 0 } }]
    })),
    vehicles: [
      {
        label: vehicleLabel,
        startWaypoint: toWaypoint(start),
        endWaypoint: toWaypoint(end),
        costPerKilometer: COST_PER_KILOMETER,
        costPerHour: COST_PER_HOUR
      }
    ]
  }
});

/**
 * Google Maps Platform — Route Optimization API (SKU Single Vehicle Routing).
 * Authentification par compte de service (pas une clé API) : JSON dans backend/googleConfig/.
 * Le client est chargé à la première optimisation : le serveur démarre sans credentials.
 */
export class GoogleRouteOptimizer extends RouteOptimizer {
  constructor({ projectId, credentialFile, timeoutSeconds = 30, validateOnly = false, client = null }) {
    super();
    this.projectId = projectId;
    this.credentialFile = credentialFile;
    this.timeoutSeconds = timeoutSeconds;
    this.validateOnly = validateOnly;
    this.client = client;
  }

  get provider() {
    return "google";
  }

  async getClient() {
    if (this.client) return this.client;
    if (!this.projectId || !this.credentialFile) {
      throw new ServiceUnavailableError("Optimisation Google non configurée (GOOGLE_CLOUD_PROJECT_ID / GOOGLE_ROUTE_OPTIMIZATION_CREDENTIAL_FILE).");
    }
    const keyFilename = path.join(CREDENTIALS_DIR, this.credentialFile);
    if (!existsSync(keyFilename)) {
      throw new ServiceUnavailableError(`Compte de service Google introuvable : backend/googleConfig/${this.credentialFile}.`);
    }
    const { RouteOptimizationClient } = await import("@googlemaps/routeoptimization");
    this.client = new RouteOptimizationClient({ keyFilename });
    return this.client;
  }

  async optimize({ start, end, stops, routeId, startTime = null }) {
    const skipped = stops.filter((s) => !s.placeId && !hasCoordinates(s)).map((s) => ({ id: s.id, reason: "Ni PlaceId ni coordonnées" }));
    const usable = stops.filter((s) => s.placeId || hasCoordinates(s));
    if (usable.length === 0) {
      return { provider: this.provider, orderedIds: [], skipped, distanceKm: 0, durationMinutes: 0 };
    }

    const request = buildOptimizeToursRequest({
      projectId: this.projectId,
      start,
      end,
      stops: usable,
      timeoutSeconds: this.timeoutSeconds,
      validateOnly: this.validateOnly,
      vehicleLabel: routeId ? `route-${routeId}` : "route",
      startTime
    });

    const client = await this.getClient();
    let response;
    try {
      [response] = await client.optimizeTours(request, { timeout: (this.timeoutSeconds + 5) * 1000 });
    } catch (error) {
      // Quota, délai, API désactivée, credentials refusés : erreur propre, rien n'est écrit
      throw new ServiceUnavailableError(`Optimisation Google indisponible : ${error.details || error.message}`);
    }

    if (this.validateOnly) {
      return { provider: this.provider, orderedIds: [], skipped, distanceKm: null, durationMinutes: null, validateOnly: true };
    }

    const route = response?.routes?.[0] ?? {};
    const orderedIds = (route.visits ?? []).map((visit) => usable[visit.shipmentIndex ?? 0].id);
    for (const s of response?.skippedShipments ?? []) {
      const reason = (s.reasons ?? []).map((r) => r.code).filter(Boolean).join(", ") || "Refusé par l'optimiseur";
      skipped.push({ id: usable[s.index ?? 0].id, reason });
    }

    const metrics = route.metrics ?? {};
    return {
      provider: this.provider,
      orderedIds,
      skipped,
      distanceKm: metrics.travelDistanceMeters != null ? Number(metrics.travelDistanceMeters) / 1000 : null,
      durationMinutes: metrics.totalDuration ? Math.round(secondsOf(metrics.totalDuration) / 60) : null
    };
  }
}
