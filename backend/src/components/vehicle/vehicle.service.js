import crypto from "node:crypto";
import db from "../../../models/index.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../errors/Errors.js";
import { logger } from "../../config/logger.js";
import { ROUTE_RUN_STATUS } from "../routeRun/routeRun.constants.js";
import { DEVICE_TOKEN_BYTES, VEHICLE_NAME_MAX_LENGTH, VEHICLE_SOURCE, VEHICLE_SOURCES } from "./vehicle.constants.js";

const { Vehicle, Route, RouteRun } = db;

/** Hash stocké en base : un vol de la base ne donne pas les jetons des appareils. */
export const hashDeviceToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

const vehicleInclude = [
  { model: Route, as: "DefaultForRoutes", attributes: ["Id", "Name"], where: { IsActive: true }, required: false },
  {
    model: RouteRun,
    as: "Runs",
    attributes: ["Id", "RouteId", "StartedAt"],
    where: { Status: ROUTE_RUN_STATUS.IN_PROGRESS },
    required: false,
    include: [{ model: Route, as: "Route", attributes: ["Id", "Name"] }]
  }
];

/** Ajoute HasToken (le hash n'est jamais renvoyé) et la tournée en cours éventuelle. */
const present = (vehicle) => {
  const json = vehicle.toJSON();
  const [currentRun] = json.Runs ?? [];
  delete json.Runs;
  return { ...json, HasToken: json.DeviceTokenCreatedAt != null, CurrentRun: currentRun ?? null };
};

export const getVehicles = async ({ includeInactive = false } = {}) => {
  const vehicles = await Vehicle.findAll({
    where: includeInactive ? {} : { IsActive: true },
    include: vehicleInclude,
    order: [["IsActive", "DESC"], ["Name", "ASC"]]
  });
  return vehicles.map(present);
};

export const getVehicleById = async (id) => {
  const vehicle = await Vehicle.findByPk(id, { include: vehicleInclude });
  if (!vehicle) {
    throw new NotFoundError("Véhicule introuvable.");
  }
  return present(vehicle);
};

/** Liste courte pour le choix du tracteur au démarrage d'une tournée (opérateur). */
export const getAvailableVehicles = async () => {
  const vehicles = await getVehicles();
  return vehicles.map(({ Id, Name, CurrentRun, LastPositionAt }) => ({
    Id,
    Name,
    LastPositionAt,
    InUseByRoute: CurrentRun?.Route?.Name ?? null
  }));
};

const normalizeFields = (input, { partial }) => {
  const fields = {};
  if (!partial || "Name" in input) {
    const name = String(input.Name ?? "").trim();
    if (!name || name.length > VEHICLE_NAME_MAX_LENGTH) {
      throw new BadRequestError(`Nom du véhicule requis (${VEHICLE_NAME_MAX_LENGTH} caractères max).`);
    }
    fields.Name = name;
  }
  if ("Notes" in input) {
    fields.Notes = input.Notes ? String(input.Notes).trim() : null;
  }
  if ("SourceType" in input) {
    if (!VEHICLE_SOURCES.includes(input.SourceType)) {
      throw new BadRequestError("Type de source invalide.");
    }
    fields.SourceType = input.SourceType;
  }
  if ("DeviceKey" in input) {
    fields.DeviceKey = input.DeviceKey ? String(input.DeviceKey).trim() : null;
  }
  if ("IsActive" in input) {
    fields.IsActive = Boolean(input.IsActive);
  }
  return fields;
};

const assertUniqueName = async (name, exceptId = null) => {
  const existing = await Vehicle.findOne({ where: { Name: name } });
  if (existing && existing.Id !== exceptId) {
    throw new ConflictError(`Un véhicule s'appelle déjà « ${name} ».`);
  }
};

export const createVehicle = async (input) => {
  const fields = normalizeFields(input ?? {}, { partial: false });
  await assertUniqueName(fields.Name);
  const vehicle = await Vehicle.create({ SourceType: VEHICLE_SOURCE.OSMAND, ...fields });
  logger.info(`Véhicule créé | #${vehicle.Id} « ${vehicle.Name} »`);
  return getVehicleById(vehicle.Id);
};

export const updateVehicle = async (id, input) => {
  const vehicle = await Vehicle.findByPk(id);
  if (!vehicle) {
    throw new NotFoundError("Véhicule introuvable.");
  }
  const fields = normalizeFields(input ?? {}, { partial: true });
  if (fields.Name) {
    await assertUniqueName(fields.Name, vehicle.Id);
  }
  if (fields.IsActive === false && vehicle.IsActive) {
    await assertNotInUse(vehicle);
  }
  Object.assign(vehicle, fields);
  await vehicle.save();
  return getVehicleById(vehicle.Id);
};

const assertNotInUse = async (vehicle) => {
  const run = await RouteRun.findOne({
    where: { VehicleId: vehicle.Id, Status: ROUTE_RUN_STATUS.IN_PROGRESS },
    include: [{ model: Route, as: "Route", attributes: ["Name"] }]
  });
  if (run) {
    throw new ConflictError(`« ${vehicle.Name} » est en tournée sur la route ${run.Route?.Name ?? ""} : terminez la tournée d'abord.`);
  }
};

/** Désactivation (jamais de suppression : les tournées passées gardent leur véhicule). */
export const deactivateVehicle = async (id) => updateVehicle(id, { IsActive: false });

/**
 * Génère un nouveau jeton d'appareil et le renvoie UNE seule fois. L'ancien cesse
 * de fonctionner immédiatement (téléphone perdu, appareil remplacé).
 */
export const regenerateDeviceToken = async (id) => {
  const vehicle = await Vehicle.findByPk(id);
  if (!vehicle) {
    throw new NotFoundError("Véhicule introuvable.");
  }
  const token = crypto.randomBytes(DEVICE_TOKEN_BYTES).toString("base64url");
  vehicle.set("DeviceTokenHash", hashDeviceToken(token));
  vehicle.DeviceTokenCreatedAt = new Date();
  await vehicle.save();
  logger.info(`Jeton d'appareil (re)généré | véhicule #${vehicle.Id} « ${vehicle.Name} »`);
  return { vehicle: await getVehicleById(vehicle.Id), token };
};

/** Véhicule actif correspondant à un jeton d'appareil, ou null. */
export const findVehicleByDeviceToken = async (token) => {
  if (!token || typeof token !== "string" || token.length > 200) {
    return null;
  }
  return Vehicle.findOne({ where: { DeviceTokenHash: hashDeviceToken(token), IsActive: true } });
};

/** Valide un VehicleId venant d'un formulaire : null/"" → null ; sinon véhicule actif existant. */
export const resolveVehicleId = async (vehicleId, label = "Véhicule") => {
  if (vehicleId === undefined) return undefined;
  if (vehicleId === null || vehicleId === "") return null;
  const vehicle = await Vehicle.findByPk(vehicleId, { attributes: ["Id", "IsActive"] });
  if (!vehicle || !vehicle.IsActive) {
    throw new BadRequestError(`${label} : véhicule introuvable ou désactivé.`);
  }
  return vehicle.Id;
};
