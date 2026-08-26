import db from "../../../models/index.js";
import { NotFoundError } from "../../errors/Errors.js";

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

export const createRoute = async (routeInfo) => {
  return Route.create(routeInfo);
};

export const updateRoute = async (id, routeInfo) => {
  const route = await Route.findByPk(id);
  if (!route) {
    throw new NotFoundError("Route introuvable.");
  }
  const { Id, ...updatable } = routeInfo;
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
