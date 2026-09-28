import db from "../../../models/index.js";
import { BadRequestError, NotFoundError } from "../../errors/Errors.js";
import { logger } from "../../config/logger.js";
import { getRouteOptimizer } from "../../routing/routeOptimizerFactory.js";
import { pathKm } from "../../routing/geo.js";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { getRouteDepot, getRouteOptimizationSettings } from "../setting/setting.service.js";
import { DRIVEWAY_SIZE, LOCATION_SOURCE } from "../serviceAddress/serviceAddress.constants.js";
import { ROUTE_CONTRACT_ORDER, updateRouteSequence } from "./route.service.js";
import { ROUTE_ORDERABLE_CONTRACT_STATUSES, ROUTE_SEQUENCE_SOURCE, UNKNOWN_SURFACE } from "./route.constants.js";

const TIME_ZONE = "America/Toronto";

const { Route, Contract, ServiceAddress } = db;

const toNumber = (value) => (value === null || value === undefined || value === "" ? null : Number(value));

/** Départ et retour : point d'attache de la route, sinon dépôt. */
const resolveEndpoint = async (route) => {
  const location = route.BaseLocation ?? (await getRouteDepot()).value;
  if (!location) {
    throw new BadRequestError("Aucun dépôt configuré : réglez-le dans Paramètres › Routes (ou un point d'attache pour cette route).");
  }
  return {
    label: location.label,
    point: { latitude: Number(location.latitude), longitude: Number(location.longitude), placeId: location.placeId ?? null }
  };
};

/** Durée de déneigement d'une entrée : minutes du revêtement × facteur de taille (réglages admin). */
export const visitSecondsFor = (address, settings) => {
  const minutes = settings.visitMinutesBySurface[address?.DrivewaySurface] ?? settings.visitMinutesBySurface[UNKNOWN_SURFACE];
  const factor = settings.sizeFactors[address?.DrivewaySize] ?? settings.sizeFactors[DRIVEWAY_SIZE.SINGLE];
  return Math.round(minutes * factor * 60);
};

/** Prochaine occurrence de l'heure de départ (HH:MM, heure de l'Est) : tempête de la nuit qui vient. */
export const nextDeparture = (departureTime, now = new Date()) => {
  const local = toZonedTime(now, TIME_ZONE);
  const day = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
  let start = fromZonedTime(`${day}T${departureTime}:00`, TIME_ZONE);
  if (start <= now) start = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return start;
};

const clockTime = (date) => {
  const local = toZonedTime(date, TIME_ZONE);
  return `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`;
};

/** Arrêt transmis à l'optimiseur : lieu, durée, ContractId. Rien de nominatif (Loi 25). */
const toStop = (contract, settings) => {
  const address = contract.ServiceAddress;
  return {
    id: contract.Id,
    latitude: toNumber(address.Latitude),
    longitude: toNumber(address.Longitude),
    placeId: address.PlaceId ?? null,
    manualPin: address.LocationSource === LOCATION_SOURCE.MANUAL_PIN,
    visitSeconds: visitSecondsFor(address, settings)
  };
};

const addressLabel = (contract) => {
  const a = contract.ServiceAddress;
  return a ? `${a.CivicNumber} ${a.Street}, ${a.City}` : "—";
};

const round1 = (km) => (km == null ? null : Math.round(km * 10) / 10);

/**
 * Propose un ordre de passage pour une saison de la route. **Rien n'est enregistré** :
 * l'admin voit la proposition, la compare, l'ajuste au besoin, puis l'applique.
 * Les arrêts que l'optimiseur ne peut pas placer sont renvoyés dans `skipped` (jamais d'échec silencieux).
 */
export const optimizeRoute = async (routeId, { seasonYear } = {}) => {
  const season = Number(seasonYear);
  if (!Number.isInteger(season)) {
    throw new BadRequestError("seasonYear est requis.");
  }
  const route = await Route.findByPk(routeId);
  if (!route) {
    throw new NotFoundError("Route introuvable.");
  }
  const endpoint = await resolveEndpoint(route);

  const contracts = await Contract.findAll({
    where: { RouteId: route.Id, SeasonStartYear: season, Status: ROUTE_ORDERABLE_CONTRACT_STATUSES },
    include: [{ model: ServiceAddress, as: "ServiceAddress" }],
    order: ROUTE_CONTRACT_ORDER
  });
  if (contracts.length < 2) {
    throw new BadRequestError("Il faut au moins 2 arrêts sur la route pour cette saison.");
  }

  const { values: settings } = await getRouteOptimizationSettings();
  const stops = contracts.map((contract) => toStop(contract, settings));
  const departure = nextDeparture(settings.departureTime);
  const optimizer = getRouteOptimizer();
  const startedAt = Date.now();
  const result = await optimizer.optimize({ start: endpoint.point, end: endpoint.point, stops, routeId: route.Id, startTime: departure });
  const elapsedMs = Date.now() - startedAt;

  // Comparaison équitable : même mesure (vol d'oiseau) pour l'ordre actuel et l'ordre proposé
  const byId = new Map(stops.map((s) => [s.id, s]));
  const placed = new Set(result.orderedIds);
  const currentStops = stops.filter((s) => placed.has(s.id));
  const proposedStops = result.orderedIds.map((id) => byId.get(id));
  const contractById = new Map(contracts.map((c) => [c.Id, c]));

  logger.info(
    `Optimisation de route | "${route.Name}" saison ${season} | ${stops.length} arrêt(s), ${result.skipped.length} exclu(s) | ${result.provider} | ${elapsedMs} ms`
  );

  return {
    provider: result.provider,
    validateOnly: Boolean(result.validateOnly),
    seasonYear: season,
    endpointLabel: endpoint.label,
    orderedContractIds: result.orderedIds,
    skipped: result.skipped.map(({ id, reason }) => ({
      contractId: id,
      reference: contractById.get(id)?.Reference ?? null,
      address: contractById.has(id) ? addressLabel(contractById.get(id)) : null,
      reason
    })),
    current: { straightLineKm: round1(pathKm(endpoint.point, currentStops, endpoint.point)) },
    proposed: {
      straightLineKm: round1(pathKm(endpoint.point, proposedStops, endpoint.point)),
      distanceKm: round1(result.distanceKm),
      durationMinutes: result.durationMinutes
    },
    departureTime: settings.departureTime,
    returnTime: result.durationMinutes != null ? clockTime(new Date(departure.getTime() + result.durationMinutes * 60000)) : null,
    visitMinutes: Math.round(proposedStops.reduce((sum, s) => sum + s.visitSeconds, 0) / 60),
    elapsedMs
  };
};

/** Enregistre l'ordre retenu après une optimisation (traçabilité : SequenceSource = optimized). */
export const applyOptimizedSequence = async (routeId, contractIds, userId) =>
  updateRouteSequence(routeId, contractIds, userId, ROUTE_SEQUENCE_SOURCE.OPTIMIZED);
