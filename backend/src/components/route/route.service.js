import db from "../../../models/index.js";
import { BadRequestError, NotFoundError } from "../../errors/Errors.js";
import { USER_ROLES } from "../user/user.constants.js";

const { Route, Contract, Client, ServiceAddress, User } = db;

export const getRoutes = async ({ includeInactive = false } = {}) => {
  const where = {};
  if (!includeInactive) {
    where.IsActive = true;
  }
  return Route.findAll({
    where,
    include: [{ model: User, as: "Operator", attributes: ["Id", "Name", "Email"] }],
    order: [["SortOrder", "ASC"], ["Name", "ASC"]]
  });
};

export const getRouteById = async (id) => {
  const route = await Route.findByPk(id, {
    include: [{ model: User, as: "Operator", attributes: ["Id", "Name", "Email"] }]
  });
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
    order: [["Reference", "ASC"]]
  });
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
  const { Id, Operator, ...creatable } = routeInfo;
  const operatorUserId = await resolveOperatorUserId(creatable.OperatorUserId);
  if (operatorUserId !== undefined) {
    creatable.OperatorUserId = operatorUserId;
  }
  return Route.create(creatable);
};

export const updateRoute = async (id, routeInfo) => {
  const route = await Route.findByPk(id);
  if (!route) {
    throw new NotFoundError("Route introuvable.");
  }
  const { Id, Operator, ...updatable } = routeInfo;
  const operatorUserId = await resolveOperatorUserId(updatable.OperatorUserId);
  if (operatorUserId !== undefined) {
    updatable.OperatorUserId = operatorUserId;
  }
  Object.assign(route, updatable);
  await route.save();
  return route;
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
