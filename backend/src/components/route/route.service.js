import db from "../../../models/index.js";
import { BadRequestError, NotFoundError } from "../../errors/Errors.js";
import { USER_ROLES } from "../user/user.constants.js";
import { logger } from "../../config/logger.js";
import { keepLocationDateIfUnchanged, normalizeNamedLocation } from "../../shared/location.js";
import { resolveVehicleId } from "../vehicle/vehicle.service.js";
import { MAX_ROUTE_SEQUENCE_LENGTH, ROUTE_ORDERABLE_CONTRACT_STATUSES, ROUTE_SEQUENCE_SOURCE } from "./route.constants.js";

const { Route, Contract, Client, ServiceAddress, User, Vehicle, sequelize } = db;

/** Ordre de passage : séquence de l'admin, les contrats pas encore placés à la fin. */
export const ROUTE_CONTRACT_ORDER = [["RouteSequence", "ASC NULLS LAST"], ["Reference", "ASC"]];

const userSummary = ["Id", "Name", "Email"];
const routeInclude = [
  { model: User, as: "Operator", attributes: userSummary },
  { model: User, as: "SequenceUpdatedBy", attributes: userSummary },
  { model: Vehicle, as: "DefaultVehicle", attributes: ["Id", "Name", "IsActive"] }
];

/** Champs gérés par le serveur, jamais modifiables par PUT /route/:id. */
const stripManagedFields = ({ Id, Operator, SequenceUpdatedBy, DefaultVehicle, SequenceSource, SequenceUpdatedAt, SequenceUpdatedByUserId, ...fields }) => fields;

/** Point d'attache : null/"" = dépôt ; sinon emplacement validé. */
const resolveBaseLocation = (fields, current = null) => {
  if (!("BaseLocation" in fields)) return;
  fields.BaseLocation = fields.BaseLocation
    ? keepLocationDateIfUnchanged(normalizeNamedLocation(fields.BaseLocation, "Point d'attache du véhicule"), current)
    : null;
};

export const getRoutes = async ({ includeInactive = false } = {}) => {
  const where = {};
  if (!includeInactive) {
    where.IsActive = true;
  }
  // Contrats « à placer » (ajoutés depuis le dernier ordre) : la liste suggère de réordonner
  const unplacedCount = sequelize.literal(
    `(SELECT COUNT(*)::int FROM "Contracts" c WHERE c."RouteId" = "Route"."Id" AND c."RouteSequence" IS NULL AND c."Status" IN (${ROUTE_ORDERABLE_CONTRACT_STATUSES.map((s) => sequelize.escape(s)).join(", ")}))`
  );
  return Route.findAll({
    where,
    attributes: { include: [[unplacedCount, "UnplacedCount"]] },
    include: routeInclude,
    order: [["SortOrder", "ASC"], ["Name", "ASC"]]
  });
};

export const getRouteById = async (id) => {
  const route = await Route.findByPk(id, { include: routeInclude });
  if (!route) {
    throw new NotFoundError("Route introuvable.");
  }
  return route;
};

export const getRouteContracts = async (id) => {
  await getRouteById(id);
  return Contract.findAll({
    where: { RouteId: id },
    include: [
      { model: Client, as: "Client" },
      { model: ServiceAddress, as: "ServiceAddress" }
    ],
    order: ROUTE_CONTRACT_ORDER
  });
};

const parseContractIds = (contractIds) => {
  if (!Array.isArray(contractIds) || contractIds.length === 0) {
    throw new BadRequestError("contractIds doit être une liste non vide.");
  }
  if (contractIds.length > MAX_ROUTE_SEQUENCE_LENGTH) {
    throw new BadRequestError(`Trop d'arrêts dans une même séquence (max ${MAX_ROUTE_SEQUENCE_LENGTH}).`);
  }
  const ids = contractIds.map(Number);
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new BadRequestError("contractIds contient un identifiant invalide.");
  }
  if (new Set(ids).size !== ids.length) {
    throw new BadRequestError("contractIds contient des doublons.");
  }
  return ids;
};

/**
 * Réécrit l'ordre de passage : `contractIds[i]` reçoit la position i + 1.
 * Tous les contrats doivent appartenir à la route (sinon rien n'est écrit).
 * Les contrats de la route absents de la liste (ex. autre saison) gardent leur position.
 * Une seule requête UPDATE, quelle que soit la taille de la route.
 * Une tournée déjà démarrée n'est pas touchée : son ordre est figé dans RouteRunStops.Sequence.
 */
export const updateRouteSequence = async (routeId, contractIds, userId, source = ROUTE_SEQUENCE_SOURCE.MANUAL) => {
  const ids = parseContractIds(contractIds);
  const route = await Route.findByPk(routeId);
  if (!route) {
    throw new NotFoundError("Route introuvable.");
  }

  await sequelize.transaction(async (transaction) => {
    const owned = await Contract.count({ where: { Id: ids, RouteId: route.Id }, transaction });
    if (owned !== ids.length) {
      throw new BadRequestError(`${ids.length - owned} contrat(s) n'appartiennent pas à cette route. Rechargez la page.`);
    }

    await sequelize.query(
      `UPDATE "Contracts" AS c
          SET "RouteSequence" = s.position, "updatedAt" = NOW()
         FROM unnest(ARRAY[:ids]::integer[]) WITH ORDINALITY AS s(id, position)
        WHERE c."Id" = s.id AND c."RouteId" = :routeId`,
      { replacements: { ids, routeId: route.Id }, transaction }
    );

    route.SequenceSource = source;
    route.SequenceUpdatedAt = new Date();
    route.SequenceUpdatedByUserId = userId ?? null;
    await route.save({ transaction });
  });

  logger.info(`Ordre de route modifié | route "${route.Name}" | ${ids.length} arrêt(s) | ${source} | par utilisateur #${userId ?? "?"}`);
  return { route: await getRouteById(route.Id), contracts: await getRouteContracts(route.Id) };
};

/** Rôles autorisés à opérer une route (un admin peut dépanner sur le terrain). */
const OPERATOR_CAPABLE_ROLES = [USER_ROLES.OPERATOR, USER_ROLES.ADMIN];

/**
 * Normalise et valide OperatorUserId : null/""/undefined → null ; sinon doit
 * désigner un utilisateur existant ayant un rôle capable d'opérer une route.
 */
const resolveOperatorUserId = async (operatorUserId) => {
  if (operatorUserId === undefined) {
    return undefined;
  }
  if (operatorUserId === null || operatorUserId === "") {
    return null;
  }
  const operator = await User.findByPk(operatorUserId, { attributes: ["Id", "Role"] });
  if (!operator || !OPERATOR_CAPABLE_ROLES.includes(operator.Role)) {
    throw new BadRequestError("L'opérateur sélectionné est introuvable ou n'a pas le rôle opérateur.");
  }
  return operator.Id;
};

export const createRoute = async (routeInfo) => {
  const creatable = stripManagedFields(routeInfo);
  resolveBaseLocation(creatable);
  const operatorUserId = await resolveOperatorUserId(creatable.OperatorUserId);
  if (operatorUserId !== undefined) {
    creatable.OperatorUserId = operatorUserId;
  }
  const defaultVehicleId = await resolveVehicleId(creatable.DefaultVehicleId, "Tracteur par défaut");
  if (defaultVehicleId !== undefined) {
    creatable.DefaultVehicleId = defaultVehicleId;
  }
  return Route.create(creatable);
};

export const updateRoute = async (id, routeInfo) => {
  const route = await Route.findByPk(id);
  if (!route) {
    throw new NotFoundError("Route introuvable.");
  }
  const updatable = stripManagedFields(routeInfo);
  resolveBaseLocation(updatable, route.BaseLocation);
  const operatorUserId = await resolveOperatorUserId(updatable.OperatorUserId);
  if (operatorUserId !== undefined) {
    updatable.OperatorUserId = operatorUserId;
  }
  // Un véhicule désactivé depuis peut rester en place tant qu'on ne touche pas au champ
  if ("DefaultVehicleId" in updatable && Number(updatable.DefaultVehicleId) !== route.DefaultVehicleId) {
    updatable.DefaultVehicleId = await resolveVehicleId(updatable.DefaultVehicleId, "Tracteur par défaut");
  } else {
    delete updatable.DefaultVehicleId;
  }
  Object.assign(route, updatable);
  await route.save();
  return getRouteById(route.Id);
};

export const deactivateRoute = async (id) => {
  const route = await Route.findByPk(id);
  if (!route) {
    throw new NotFoundError("Route introuvable.");
  }
  route.IsActive = false;
  await route.save();
  return route;
};
