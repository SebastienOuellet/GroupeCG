import * as routeService from "./route.service.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { USER_ROLES } from "../user/user.constants.js";

const adminOnly = requireRole(USER_ROLES.ADMIN);

const getRoutes = async (req, res, next) => {
  try {
    const routes = await routeService.getRoutes({
      includeInactive: req.query.includeInactive === "true"
    });
    res.status(200).json(routes);
  } catch (error) {
    next(error);
  }
};

const getRouteById = async (req, res, next) => {
  try {
    const route = await routeService.getRouteById(req.params.id);
    res.status(200).json(route);
  } catch (error) {
    next(error);
  }
};

const getRouteContracts = async (req, res, next) => {
  try {
    const contracts = await routeService.getRouteContracts(req.params.id);
    res.status(200).json(contracts);
  } catch (error) {
    next(error);
  }
};

const createRoute = async (req, res, next) => {
  try {
    const route = await routeService.createRoute(req.body);
    res.status(201).json(route);
  } catch (error) {
    next(error);
  }
};

const updateRoute = async (req, res, next) => {
  try {
    const route = await routeService.updateRoute(req.params.id, req.body);
    res.status(200).json(route);
  } catch (error) {
    next(error);
  }
};

const deactivateRoute = async (req, res, next) => {
  try {
    await routeService.deactivateRoute(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const routeController = {
  routes: [
    { method: "GET", url: "", middleware: [adminOnly, getRoutes], authRequired: true },
    { method: "GET", url: "/:id", middleware: [adminOnly, getRouteById], authRequired: true },
    { method: "GET", url: "/:id/contracts", middleware: [adminOnly, getRouteContracts], authRequired: true },
    { method: "POST", url: "", middleware: [adminOnly, createRoute], authRequired: true },
    { method: "PUT", url: "/:id", middleware: [adminOnly, updateRoute], authRequired: true },
    { method: "DELETE", url: "/:id", middleware: [adminOnly, deactivateRoute], authRequired: true }
  ]
};
