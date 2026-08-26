import * as templateService from "./template.service.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { USER_ROLES } from "../user/user.constants.js";

const adminOnly = requireRole(USER_ROLES.ADMIN);

const getTemplates = async (req, res, next) => {
  try {
    res.status(200).json(await templateService.getTemplates({
      includeInactive: req.query.includeInactive === "true"
    }));
  } catch (error) {
    next(error);
  }
};

const getTemplateById = async (req, res, next) => {
  try {
    res.status(200).json(await templateService.getTemplateById(req.params.id));
  } catch (error) {
    next(error);
  }
};

const createTemplate = async (req, res, next) => {
  try {
    res.status(201).json(await templateService.createTemplate(req.body));
  } catch (error) {
    next(error);
  }
};

const updateTemplate = async (req, res, next) => {
  try {
    res.status(200).json(await templateService.updateTemplate(req.params.id, req.body));
  } catch (error) {
    next(error);
  }
};

const deactivateTemplate = async (req, res, next) => {
  try {
    await templateService.deactivateTemplate(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const templateController = {
  routes: [
    { method: "GET", url: "", middleware: [adminOnly, getTemplates], authRequired: true },
    { method: "GET", url: "/:id", middleware: [adminOnly, getTemplateById], authRequired: true },
    { method: "POST", url: "", middleware: [adminOnly, createTemplate], authRequired: true },
    { method: "PUT", url: "/:id", middleware: [adminOnly, updateTemplate], authRequired: true },
    { method: "DELETE", url: "/:id", middleware: [adminOnly, deactivateTemplate], authRequired: true }
  ]
};
