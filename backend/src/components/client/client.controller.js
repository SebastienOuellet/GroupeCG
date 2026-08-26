import * as clientService from "./client.service.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { USER_ROLES } from "../user/user.constants.js";

const adminOnly = requireRole(USER_ROLES.ADMIN);

const getClients = async (req, res, next) => {
  try {
    const { search, includeInactive } = req.query;
    const clients = await clientService.getClients({
      search,
      includeInactive: includeInactive === "true"
    });
    res.status(200).json(clients);
  } catch (error) {
    next(error);
  }
};

const getClientById = async (req, res, next) => {
  try {
    const client = await clientService.getClientById(req.params.id);
    res.status(200).json(client);
  } catch (error) {
    next(error);
  }
};

const createClient = async (req, res, next) => {
  try {
    const client = await clientService.createClient(req.body);
    res.status(201).json(client);
  } catch (error) {
    next(error);
  }
};

const updateClient = async (req, res, next) => {
  try {
    const client = await clientService.updateClient(req.params.id, req.body);
    res.status(200).json(client);
  } catch (error) {
    next(error);
  }
};

const deactivateClient = async (req, res, next) => {
  try {
    await clientService.deactivateClient(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const clientController = {
  routes: [
    { method: "GET", url: "", middleware: [adminOnly, getClients], authRequired: true },
    { method: "GET", url: "/:id", middleware: [adminOnly, getClientById], authRequired: true },
    { method: "POST", url: "", middleware: [adminOnly, createClient], authRequired: true },
    { method: "PUT", url: "/:id", middleware: [adminOnly, updateClient], authRequired: true },
    { method: "DELETE", url: "/:id", middleware: [adminOnly, deactivateClient], authRequired: true }
  ]
};
