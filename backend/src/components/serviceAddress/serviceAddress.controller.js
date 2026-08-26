import * as serviceAddressService from "./serviceAddress.service.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { USER_ROLES } from "../user/user.constants.js";

const adminOnly = requireRole(USER_ROLES.ADMIN);

const getServiceAddresses = async (req, res, next) => {
  try {
    const { clientId, includeInactive } = req.query;
    const addresses = await serviceAddressService.getServiceAddresses({
      clientId,
      includeInactive: includeInactive === "true"
    });
    res.status(200).json(addresses);
  } catch (error) {
    next(error);
  }
};

const getServiceAddressById = async (req, res, next) => {
  try {
    const address = await serviceAddressService.getServiceAddressById(req.params.id);
    res.status(200).json(address);
  } catch (error) {
    next(error);
  }
};

const createServiceAddress = async (req, res, next) => {
  try {
    const address = await serviceAddressService.createServiceAddress(req.body);
    res.status(201).json(address);
  } catch (error) {
    next(error);
  }
};

const updateServiceAddress = async (req, res, next) => {
  try {
    const address = await serviceAddressService.updateServiceAddress(req.params.id, req.body);
    res.status(200).json(address);
  } catch (error) {
    next(error);
  }
};

const deactivateServiceAddress = async (req, res, next) => {
  try {
    await serviceAddressService.deactivateServiceAddress(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const serviceAddressController = {
  routes: [
    { method: "GET", url: "", middleware: [adminOnly, getServiceAddresses], authRequired: true },
    { method: "GET", url: "/:id", middleware: [adminOnly, getServiceAddressById], authRequired: true },
    { method: "POST", url: "", middleware: [adminOnly, createServiceAddress], authRequired: true },
    { method: "PUT", url: "/:id", middleware: [adminOnly, updateServiceAddress], authRequired: true },
    { method: "DELETE", url: "/:id", middleware: [adminOnly, deactivateServiceAddress], authRequired: true }
  ]
};
