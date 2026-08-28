import * as routeRunService from "./routeRun.service.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { USER_ROLES } from "../user/user.constants.js";

const operatorAccess = requireRole([USER_ROLES.ADMIN, USER_ROLES.OPERATOR]);

const getMyRoutes = async (req, res, next) => {
  try {
    res.status(200).json(await routeRunService.getMyRoutes(req.user));
  } catch (error) {
    next(error);
  }
};

const getCurrentRun = async (req, res, next) => {
  try {
    const { route, run } = await routeRunService.getCurrentRun(req.params.routeId, req.user);
    res.status(200).json({ route, run });
  } catch (error) {
    next(error);
  }
};

const startRouteRun = async (req, res, next) => {
  try {
    const run = await routeRunService.startRouteRun(req.body.routeId, req.user);
    res.status(201).json(run);
  } catch (error) {
    next(error);
  }
};

const updateStop = async (req, res, next) => {
  try {
    const stop = await routeRunService.updateStop(req.params.id, req.body.status, req.user);
    res.status(200).json(stop);
  } catch (error) {
    next(error);
  }
};

const completeRouteRun = async (req, res, next) => {
  try {
    const run = await routeRunService.completeRouteRun(req.params.id, req.user);
    res.status(200).json(run);
  } catch (error) {
    next(error);
  }
};

export const routeRunController = {
  routes: [
    { method: "GET", url: "/my-routes", middleware: [operatorAccess, getMyRoutes], authRequired: true },
    { method: "GET", url: "/route/:routeId/current", middleware: [operatorAccess, getCurrentRun], authRequired: true },
    { method: "POST", url: "/start", middleware: [operatorAccess, startRouteRun], authRequired: true },
    { method: "PUT", url: "/stops/:id", middleware: [operatorAccess, updateStop], authRequired: true },
    { method: "POST", url: "/:id/complete", middleware: [operatorAccess, completeRouteRun], authRequired: true }
  ]
};
