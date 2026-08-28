import db from "../../../models/index.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../errors/Errors.js";
import { logger } from "../../config/logger.js";
import * as notificationService from "../notification/notification.service.js";
import { ROUTE_RUN_STATUS, ROUTE_RUN_STOP_STATUS, ROUTE_RUN_STOP_STATUSES } from "./routeRun.constants.js";
import { CONTRACT_STATUS } from "../contract/contract.constants.js";
import { BATCH_TYPES, TARGET_TYPES } from "../notification/notification.constants.js";
import { TEMPLATE_TYPES } from "../template/template.model.js";
import { USER_ROLES } from "../user/user.constants.js";

const { Route, RouteRun, RouteRunStop, Contract, Client, ServiceAddress, NotificationTemplate, sequelize } = db;

const DEFAULT_ROUTE_START_SMS =
  "Bonjour {{prenom}}, notre équipe s'en vient déneiger à {{adresse}} sous peu. Merci de déplacer votre véhicule si possible.";
const DEFAULT_ROUTE_START_SUBJECT = "Déneigement en cours";
const DEFAULT_ROUTE_START_EMAIL =
  "Bonjour {{prenom}},\n\nNotre équipe s'en vient déneiger à {{adresse}} sous peu. Merci de déplacer votre véhicule si possible.\n\nMerci de votre collaboration.";

const stopInclude = [
  {
    model: RouteRunStop,
    as: "Stops",
    include: [
      {
        model: Contract,
        as: "Contract",
        include: [
          { model: Client, as: "Client" },
          { model: ServiceAddress, as: "ServiceAddress" }
        ]
      }
    ]
  }
];

/** Un opérateur ne peut agir que sur SES routes; l'admin peut tout faire. */
const assertRouteAccess = (route, user) => {
  if (user.Role === USER_ROLES.OPERATOR && route.OperatorUserId !== user.Id) {
    throw new ForbiddenError("Cette route ne vous est pas assignée.");
  }
};

export const getMyRoutes = async (user) => {
  return Route.findAll({
    where: { OperatorUserId: user.Id, IsActive: true },
    include: [{ model: RouteRun, as: "Runs", where: { Status: ROUTE_RUN_STATUS.IN_PROGRESS }, required: false }],
    order: [["SortOrder", "ASC"], ["Name", "ASC"]]
  });
};

/** Tournée en cours pour une route donnée, ou `null` s'il n'y en a pas. */
export const getCurrentRun = async (routeId, user) => {
  const route = await Route.findByPk(routeId);
  if (!route) {
    throw new NotFoundError("Route introuvable.");
  }
  assertRouteAccess(route, user);

  const run = await RouteRun.findOne({
    where: { RouteId: routeId, Status: ROUTE_RUN_STATUS.IN_PROGRESS },
    include: [{ model: Route, as: "Route" }, ...stopInclude]
  });

  return { route, run };
};

/**
 * Démarre une tournée: crée le RouteRun + un arrêt par contrat actif de la
 * route, puis met en file une notification "on s'en vient" pour ces
 * contrats. Refuse si une tournée est déjà en cours sur cette route.
 */
export const startRouteRun = async (routeId, user) => {
  if (!routeId) {
    throw new BadRequestError("routeId est requis.");
  }

  const route = await Route.findByPk(routeId);
  if (!route || !route.IsActive) {
    throw new NotFoundError("Route introuvable.");
  }
  assertRouteAccess(route, user);

  const existing = await RouteRun.findOne({ where: { RouteId: routeId, Status: ROUTE_RUN_STATUS.IN_PROGRESS } });
  if (existing) {
    throw new ConflictError("Une tournée est déjà en cours pour cette route.");
  }

  const activeContracts = await Contract.findAll({
    where: { RouteId: routeId, Status: CONTRACT_STATUS.ACTIVE }
  });

  const template = await NotificationTemplate.findOne({
    where: { Type: TEMPLATE_TYPES.ROUTE_START, IsActive: true }
  });

  const runId = await sequelize.transaction(async (transaction) => {
    const run = await RouteRun.create(
      { RouteId: routeId, OperatorUserId: user.Id, Status: ROUTE_RUN_STATUS.IN_PROGRESS },
      { transaction }
    );

    if (activeContracts.length > 0) {
      await RouteRunStop.bulkCreate(
        activeContracts.map((contract) => ({
          RouteRunId: run.Id,
          ContractId: contract.Id,
          Status: ROUTE_RUN_STOP_STATUS.PENDING
        })),
        { transaction }
      );
    }

    return run.Id;
  });

  try {
    const batch = await notificationService.enqueueBatch({
      type: BATCH_TYPES.ROUTE_START,
      targetType: TARGET_TYPES.ROUTE,
      targetId: routeId,
      templateId: template?.Id ?? null,
      smsBody: template ? undefined : DEFAULT_ROUTE_START_SMS,
      emailSubject: template ? undefined : DEFAULT_ROUTE_START_SUBJECT,
      emailBody: template ? undefined : DEFAULT_ROUTE_START_EMAIL,
      useSms: template ? !!template.SmsBody : true,
      useEmail: template ? !!(template.EmailSubject && template.EmailBody) : true,
      createdByUserId: user.Id
    });
    await RouteRun.update({ NotificationBatchId: batch.Id }, { where: { Id: runId } });
  } catch (error) {
    // La tournée est démarrée même si la notification échoue à se mettre en
    // file (ex. modèle mal configuré) — l'opérateur ne doit pas être bloqué.
    logger.error(`Notification de départ de route échouée pour la route ${routeId}: ${error.message}`);
  }

  logger.info(`Tournée démarrée | route "${route.Name}" par utilisateur #${user.Id} | ${activeContracts.length} arrêt(s)`);

  return RouteRun.findByPk(runId, { include: [{ model: Route, as: "Route" }, ...stopInclude] });
};

export const updateStop = async (stopId, status, user) => {
  if (!ROUTE_RUN_STOP_STATUSES.includes(status)) {
    throw new BadRequestError(`Statut d'arrêt invalide: ${status}`);
  }

  const stop = await RouteRunStop.findByPk(stopId, {
    include: [{ model: RouteRun, as: "RouteRun", include: [{ model: Route, as: "Route" }] }]
  });
  if (!stop) {
    throw new NotFoundError("Arrêt introuvable.");
  }
  assertRouteAccess(stop.RouteRun.Route, user);

  stop.Status = status;
  stop.DoneAt = status === ROUTE_RUN_STOP_STATUS.PENDING ? null : new Date();
  await stop.save();
  return stop;
};

export const completeRouteRun = async (runId, user) => {
  const run = await RouteRun.findByPk(runId, { include: [{ model: Route, as: "Route" }] });
  if (!run) {
    throw new NotFoundError("Tournée introuvable.");
  }
  assertRouteAccess(run.Route, user);

  if (run.Status !== ROUTE_RUN_STATUS.IN_PROGRESS) {
    throw new ConflictError("Cette tournée n'est pas en cours.");
  }

  run.Status = ROUTE_RUN_STATUS.COMPLETED;
  run.CompletedAt = new Date();
  await run.save();

  logger.info(`Tournée terminée | route "${run.Route.Name}" par utilisateur #${user.Id}`);
  return run;
};
