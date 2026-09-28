import * as vehicleService from "./vehicle.service.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { USER_ROLES } from "../user/user.constants.js";

const adminOnly = requireRole(USER_ROLES.ADMIN);
const operatorAccess = requireRole([USER_ROLES.ADMIN, USER_ROLES.OPERATOR]);

const getVehicles = async (req, res, next) => {
  try {
    res.status(200).json(await vehicleService.getVehicles({ includeInactive: req.query.includeInactive === "true" }));
  } catch (error) {
    next(error);
  }
};

const getAvailableVehicles = async (req, res, next) => {
  try {
    res.status(200).json(await vehicleService.getAvailableVehicles());
  } catch (error) {
    next(error);
  }
};

const getVehicle = async (req, res, next) => {
  try {
    res.status(200).json(await vehicleService.getVehicleById(req.params.id));
  } catch (error) {
    next(error);
  }
};

const createVehicle = async (req, res, next) => {
  try {
    res.status(201).json(await vehicleService.createVehicle(req.body));
  } catch (error) {
    next(error);
  }
};

const updateVehicle = async (req, res, next) => {
  try {
    res.status(200).json(await vehicleService.updateVehicle(req.params.id, req.body));
  } catch (error) {
    next(error);
  }
};

const deactivateVehicle = async (req, res, next) => {
  try {
    res.status(200).json(await vehicleService.deactivateVehicle(req.params.id));
  } catch (error) {
    next(error);
  }
};

const regenerateToken = async (req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(await vehicleService.regenerateDeviceToken(req.params.id));
  } catch (error) {
    next(error);
  }
};

export const vehicleController = {
  routes: [
    { method: "GET", url: "/", middleware: [adminOnly, getVehicles], authRequired: true },
    { method: "GET", url: "/available", middleware: [operatorAccess, getAvailableVehicles], authRequired: true },
    { method: "GET", url: "/:id", middleware: [adminOnly, getVehicle], authRequired: true },
    { method: "POST", url: "/", middleware: [adminOnly, createVehicle], authRequired: true },
    { method: "PUT", url: "/:id", middleware: [adminOnly, updateVehicle], authRequired: true },
    { method: "DELETE", url: "/:id", middleware: [adminOnly, deactivateVehicle], authRequired: true },
    { method: "POST", url: "/:id/token", middleware: [adminOnly, regenerateToken], authRequired: true }
  ]
};
