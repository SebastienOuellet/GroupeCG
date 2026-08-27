import * as portalService from "./portal.service.js";
import { portalAuth } from "./portal.auth.js";
import { portalRateLimit, publicRateLimit } from "../../middlewares/rateLimit.js";

const login = async (req, res, next) => {
  try {
    const result = await portalService.login(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    res.status(200).json(await portalService.getMe(req.portalContractId));
  } catch (error) {
    next(error);
  }
};

const createTenant = async (req, res, next) => {
  try {
    const tenant = await portalService.createTenant(req.portalContractId, req.body, req.ip);
    res.status(201).json(tenant);
  } catch (error) {
    next(error);
  }
};

const updateTenant = async (req, res, next) => {
  try {
    const tenant = await portalService.updateTenant(req.portalContractId, req.params.id, req.body, req.ip);
    res.status(200).json(tenant);
  } catch (error) {
    next(error);
  }
};

const deactivateTenant = async (req, res, next) => {
  try {
    await portalService.deactivateTenant(req.portalContractId, req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

const updatePreferences = async (req, res, next) => {
  try {
    const preferences = await portalService.updatePreferences(req.portalContractId, req.body, req.ip);
    res.status(200).json(preferences);
  } catch (error) {
    next(error);
  }
};

export const portalController = {
  routes: [
    { method: "POST", url: "/login", middleware: [portalRateLimit, login], authRequired: false },
    { method: "GET", url: "/me", middleware: [publicRateLimit, portalAuth, getMe], authRequired: false },
    { method: "POST", url: "/tenants", middleware: [publicRateLimit, portalAuth, createTenant], authRequired: false },
    { method: "PUT", url: "/tenants/:id", middleware: [publicRateLimit, portalAuth, updateTenant], authRequired: false },
    { method: "DELETE", url: "/tenants/:id", middleware: [publicRateLimit, portalAuth, deactivateTenant], authRequired: false },
    { method: "PUT", url: "/preferences", middleware: [publicRateLimit, portalAuth, updatePreferences], authRequired: false }
  ]
};
