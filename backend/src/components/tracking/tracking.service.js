import db from "../../../models/index.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../errors/Errors.js";
import { logger } from "../../config/logger.js";
import { ROUTE_RUN_STATUS } from "../routeRun/routeRun.constants.js";
import { USER_ROLES } from "../user/user.constants.js";
import { getTrackingSettings } from "../setting/setting.service.js";
import { POSITION_RULES, POSITION_SOURCE, POSITION_SOURCES, STALE_POSITION_MS } from "./tracking.constants.js";

const { RouteRun, RouteRunStop, Route, User, Vehicle, VehiclePosition, Contract, ServiceAddress, Sequelize, sequelize } = db;
const { Op } = Sequelize;

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const inRange = (value, min, max) => value != null && Number.isFinite(value) && value >= min && value <= max;
const optional = (value, min, max) => (inRange(value, min, max) ? value : null);
const round = (value, decimals) => (value == null ? null : Math.round(value * 10 ** decimals) / 10 ** decimals);

/**
 * Position brute (osmandParser ou navigateur) → ligne prête à insérer, ou null si inutilisable.
 * Sans heure d'appareil, on prend l'heure du serveur ; une heure trop dans le futur est rejetée.
 */
export const normalizePosition = (raw, now = new Date()) => {
  const latitude = Number(raw?.latitude);
  const longitude = Number(raw?.longitude);
  if (!inRange(latitude, -90, 90) || !inRange(longitude, -180, 180)) return null;
  // (0, 0) : GPS sans signal qui renvoie la valeur par défaut
  if (Math.abs(latitude) < 0.001 && Math.abs(longitude) < 0.001) return null;

  const recordedAt = raw.recordedAt instanceof Date ? raw.recordedAt : raw.recordedAt ? new Date(raw.recordedAt) : now;
  if (Number.isNaN(recordedAt.getTime()) || recordedAt.getTime() > now.getTime() + POSITION_RULES.maxFutureSkewMs) return null;

  return {
    Latitude: round(latitude, 6),
    Longitude: round(longitude, 6),
    SpeedKmh: round(optional(numberOrNull(raw.speedKmh), 0, 300), 1),
    Heading: round(optional(numberOrNull(raw.heading), 0, 360), 1),
    AccuracyM: round(optional(numberOrNull(raw.accuracyM), 0, 100000), 1),
    RecordedAt: recordedAt,
    batteryPercent: optional(numberOrNull(raw.batteryPercent), 0, 100)
  };
};

const numberOrNull = (value) => (value == null || value === "" ? null : Number(value));

/* ------------------------------------------------------------------ */
/* Réception                                                           */
/* ------------------------------------------------------------------ */

/**
 * Enregistre des positions pour une tournée en cours. Les positions antérieures au
 * démarrage (hors quart de travail) et invalides sont jetées. Met à jour la dernière
 * position du véhicule si ces positions sont plus récentes.
 */
const storePositions = async (run, vehicle, rawPositions, source) => {
  if (!POSITION_SOURCES.includes(source)) {
    throw new BadRequestError("Source de position inconnue.");
  }
  if (!Array.isArray(rawPositions) || rawPositions.length === 0) {
    return { accepted: 0, rejected: 0 };
  }
  if (rawPositions.length > POSITION_RULES.maxPerRequest) {
    throw new BadRequestError(`Trop de positions dans une requête (max ${POSITION_RULES.maxPerRequest}).`);
  }

  const now = new Date();
  const earliest = new Date(run.StartedAt).getTime() - POSITION_RULES.maxBeforeRunStartMs;
  const rows = rawPositions
    .map((raw) => normalizePosition(raw, now))
    .filter((row) => row && row.RecordedAt.getTime() >= earliest)
    .sort((a, b) => a.RecordedAt - b.RecordedAt);

  if (rows.length > 0) {
    await VehiclePosition.bulkCreate(
      rows.map(({ batteryPercent, ...row }) => ({ ...row, VehicleId: vehicle?.Id ?? null, RouteRunId: run.Id, Source: source }))
    );
    if (vehicle) {
      await updateVehicleLastPosition(vehicle, rows[rows.length - 1]);
    }
  }
  return { accepted: rows.length, rejected: rawPositions.length - rows.length };
};

const updateVehicleLastPosition = async (vehicle, latest) => {
  const current = vehicle.LastPositionAt ? new Date(vehicle.LastPositionAt).getTime() : 0;
  // Un tampon vidé en retard ne doit pas faire reculer la dernière position connue
  if (latest.RecordedAt.getTime() <= current) return;
  await Vehicle.update(
    {
      LastPositionAt: latest.RecordedAt,
      LastLatitude: latest.Latitude,
      LastLongitude: latest.Longitude,
      LastSpeedKmh: latest.SpeedKmh,
      LastHeading: latest.Heading,
      ...(latest.batteryPercent != null ? { LastBatteryPercent: Math.round(latest.batteryPercent) } : {})
    },
    { where: { Id: vehicle.Id } }
  );
};

/**
 * Positions d'un appareil (OsmAnd). Sans tournée en cours pour ce véhicule, tout est
 * jeté : aucun suivi hors quart de travail (Loi 25). Réponse 200 quand même, pour que
 * l'appareil ne s'acharne pas à renvoyer.
 */
export const ingestDevicePositions = async (vehicle, rawPositions) => {
  const run = await RouteRun.findOne({
    where: { VehicleId: vehicle.Id, Status: ROUTE_RUN_STATUS.IN_PROGRESS },
    attributes: ["Id", "StartedAt"]
  });
  if (!run) {
    return { accepted: 0, rejected: rawPositions.length, reason: "no_active_run" };
  }
  return storePositions(run, vehicle, rawPositions, POSITION_SOURCE.OSMAND);
};

/** Positions du GPS du téléphone, envoyées par la page de tournée de l'opérateur. */
export const ingestBrowserPositions = async (runId, user, rawPositions) => {
  const run = await RouteRun.findByPk(runId, {
    attributes: ["Id", "StartedAt", "Status", "VehicleId"],
    include: [
      { model: Route, as: "Route", attributes: ["Id", "OperatorUserId"] },
      { model: Vehicle, as: "Vehicle" }
    ]
  });
  if (!run) {
    throw new NotFoundError("Tournée introuvable.");
  }
  if (user.Role === USER_ROLES.OPERATOR && run.Route?.OperatorUserId !== user.Id) {
    throw new ForbiddenError("Cette route ne vous est pas assignée.");
  }
  if (run.Status !== ROUTE_RUN_STATUS.IN_PROGRESS) {
    throw new ConflictError("Cette tournée n'est pas en cours.");
  }
  return storePositions(run, run.Vehicle, rawPositions, POSITION_SOURCE.BROWSER);
};

/* ------------------------------------------------------------------ */
/* Carte en direct                                                     */
/* ------------------------------------------------------------------ */

const positionJson = (p) => ({
  latitude: Number(p.Latitude),
  longitude: Number(p.Longitude),
  speedKmh: p.SpeedKmh == null ? null : Number(p.SpeedKmh),
  heading: p.Heading == null ? null : Number(p.Heading),
  accuracyM: p.AccuracyM == null ? null : Number(p.AccuracyM),
  source: p.Source,
  recordedAt: p.RecordedAt
});

/** Dernière position de chaque tournée (une seule requête, DISTINCT ON). */
export const getLastPositions = async (runIds) => {
  if (runIds.length === 0) return new Map();
  const rows = await sequelize.query(
    `SELECT DISTINCT ON ("RouteRunId") "RouteRunId", "Latitude", "Longitude", "SpeedKmh", "Heading", "AccuracyM", "Source", "RecordedAt"
       FROM "VehiclePositions" WHERE "RouteRunId" IN (:runIds)
      ORDER BY "RouteRunId", "RecordedAt" DESC, "Id" DESC`,
    { replacements: { runIds }, type: Sequelize.QueryTypes.SELECT }
  );
  return new Map(rows.map((row) => [row.RouteRunId, positionJson(row)]));
};

/** Signal de suivi pour la vue opérateur : dernière position reçue et si elle est récente. */
export const describeSignal = (lastPosition, now = Date.now()) => {
  if (!lastPosition) return { lastPositionAt: null, isStale: true };
  const at = new Date(lastPosition.recordedAt);
  return { lastPositionAt: at, source: lastPosition.source, isStale: now - at.getTime() > STALE_POSITION_MS };
};

const addressJson = (address) =>
  address
    ? {
        label: `${address.CivicNumber} ${address.Street}`,
        city: address.City,
        latitude: address.Latitude == null ? null : Number(address.Latitude),
        longitude: address.Longitude == null ? null : Number(address.Longitude)
      }
    : null;

/**
 * Tournées en cours pour la carte admin : route, opérateur, véhicule, arrêts (état +
 * position), dernière position et traînée des `liveTrailMinutes` dernières minutes.
 */
export const getLiveRuns = async () => {
  const { values: settings } = await getTrackingSettings();
  const runs = await RouteRun.findAll({
    where: { Status: ROUTE_RUN_STATUS.IN_PROGRESS },
    include: [
      { model: Route, as: "Route", attributes: ["Id", "Name"] },
      { model: User, as: "Operator", attributes: ["Id", "Name", "Email"] },
      { model: Vehicle, as: "Vehicle", attributes: ["Id", "Name", "LastBatteryPercent"] },
      {
        model: RouteRunStop,
        as: "Stops",
        attributes: ["Id", "Sequence", "Status", "DoneAt", "ContractId"],
        include: [
          {
            model: Contract,
            as: "Contract",
            attributes: ["Id", "Reference"],
            include: [{ model: ServiceAddress, as: "ServiceAddress", attributes: ["CivicNumber", "Street", "City", "Latitude", "Longitude"] }]
          }
        ]
      }
    ],
    order: [["StartedAt", "ASC"], [{ model: RouteRunStop, as: "Stops" }, "Sequence", "ASC"]]
  });

  const runIds = runs.map((run) => run.Id);
  const since = new Date(Date.now() - settings.liveTrailMinutes * 60 * 1000);
  const [lastPositions, trailRows] = await Promise.all([
    getLastPositions(runIds),
    runIds.length === 0
      ? []
      : VehiclePosition.findAll({
          where: { RouteRunId: { [Op.in]: runIds }, RecordedAt: { [Op.gte]: since } },
          attributes: ["RouteRunId", "Latitude", "Longitude", "RecordedAt"],
          order: [["RecordedAt", "ASC"], ["Id", "ASC"]]
        })
  ]);

  const trails = new Map();
  for (const row of trailRows) {
    if (!trails.has(row.RouteRunId)) trails.set(row.RouteRunId, []);
    trails.get(row.RouteRunId).push([Number(row.Latitude), Number(row.Longitude)]);
  }

  return {
    generatedAt: new Date(),
    staleAfterMs: STALE_POSITION_MS,
    runs: runs.map((run) => {
      const stops = run.Stops ?? [];
      const lastPosition = lastPositions.get(run.Id) ?? null;
      return {
        id: run.Id,
        startedAt: run.StartedAt,
        route: run.Route ? { id: run.Route.Id, name: run.Route.Name } : null,
        operator: run.Operator ? { id: run.Operator.Id, name: run.Operator.Name || run.Operator.Email } : null,
        vehicle: run.Vehicle ? { id: run.Vehicle.Id, name: run.Vehicle.Name, batteryPercent: run.Vehicle.LastBatteryPercent } : null,
        doneCount: stops.filter((stop) => stop.Status !== "pending").length,
        totalCount: stops.length,
        lastPosition,
        signal: describeSignal(lastPosition),
        trail: trails.get(run.Id) ?? [],
        stops: stops.map((stop) => ({
          id: stop.Id,
          sequence: stop.Sequence,
          status: stop.Status,
          doneAt: stop.DoneAt,
          reference: stop.Contract?.Reference ?? null,
          address: addressJson(stop.Contract?.ServiceAddress)
        }))
      };
    })
  };
};

/** Tracé complet d'une tournée (tant que ses positions ne sont pas purgées). */
export const getRunTrace = async (runId) => {
  const run = await RouteRun.findByPk(runId, {
    attributes: ["Id", "RouteId", "Status", "StartedAt", "CompletedAt"],
    include: [
      { model: Route, as: "Route", attributes: ["Id", "Name"] },
      { model: Vehicle, as: "Vehicle", attributes: ["Id", "Name"] }
    ]
  });
  if (!run) {
    throw new NotFoundError("Tournée introuvable.");
  }
  const positions = await VehiclePosition.findAll({
    where: { RouteRunId: run.Id },
    order: [["RecordedAt", "ASC"], ["Id", "ASC"]]
  });
  return { run, positions: positions.map(positionJson) };
};

/* ------------------------------------------------------------------ */
/* Purge                                                               */
/* ------------------------------------------------------------------ */

/** Supprime les positions brutes plus vieilles que `positionRetentionDays`. */
export const purgeOldPositions = async () => {
  const { values } = await getTrackingSettings();
  const cutoff = new Date(Date.now() - values.positionRetentionDays * 24 * 60 * 60 * 1000);
  const count = await VehiclePosition.destroy({ where: { RecordedAt: { [Op.lt]: cutoff } } });
  if (count > 0) {
    logger.info(`Purge des positions : ${count} position(s) de plus de ${values.positionRetentionDays} jour(s) supprimée(s).`);
  }
  return { count, cutoff };
};
