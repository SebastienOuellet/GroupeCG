import * as tenantService from "./tenant.service.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { USER_ROLES } from "../user/user.constants.js";

const adminOnly = requireRole(USER_ROLES.ADMIN);

const getTenants = async (req, res, next) => {
  try {
    const { serviceAddressId, includeInactive } = req.query;
    const tenants = await tenantService.getTenants({
      serviceAddressId,
      includeInactive: includeInactive === "true"
    });
    res.status(200).json(tenants);
  } catch (error) {
    next(error);
  }
};

const getTenantById = async (req, res, next) => {
  try {
    const tenant = await tenantService.getTenantById(req.params.id);
    res.status(200).json(tenant);
  } catch (error) {
    next(error);
  }
};

const createTenant = async (req, res, next) => {
  try {
    const tenant = await tenantService.createTenant(req.body, { actorUserId: req.user?.Id });
    res.status(201).json(tenant);
  } catch (error) {
    next(error);
  }
};

const updateTenant = async (req, res, next) => {
  try {
    const tenant = await tenantService.updateTenant(req.params.id, req.body, { actorUserId: req.user?.Id });
    res.status(200).json(tenant);
  } catch (error) {
    next(error);
  }
};

const deactivateTenant = async (req, res, next) => {
  try {
    await tenantService.deactivateTenant(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const tenantController = {
  routes: [
    { method: "GET", url: "", middleware: [adminOnly, getTenants], authRequired: true },
    { method: "GET", url: "/:id", middleware: [adminOnly, getTenantById], authRequired: true },
    { method: "POST", url: "", middleware: [adminOnly, createTenant], authRequired: true },
    { method: "PUT", url: "/:id", middleware: [adminOnly, updateTenant], authRequired: true },
    { method: "DELETE", url: "/:id", middleware: [adminOnly, deactivateTenant], authRequired: true }
  ]
};
