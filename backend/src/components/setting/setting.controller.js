import * as settingService from "./setting.service.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { USER_ROLES } from "../user/user.constants.js";

const adminOnly = requireRole(USER_ROLES.ADMIN);

const getContractTerms = async (req, res, next) => {
  try {
    res.status(200).json(await settingService.getContractTerms());
  } catch (error) {
    next(error);
  }
};

const updateContractTerms = async (req, res, next) => {
  try {
    res.status(200).json(await settingService.updateContractTerms(req.body, req.user?.Id ?? null));
  } catch (error) {
    next(error);
  }
};

/** PDF d'un contrat fictif avec les valeurs du formulaire (enregistrées ou non). */
const previewContractTerms = async (req, res, next) => {
  try {
    const pdf = await settingService.buildContractTermsPreview(req.body);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=\"Contrat-exemple.pdf\"");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(pdf);
  } catch (error) {
    next(error);
  }
};

const getRouteDepot = async (req, res, next) => {
  try {
    res.status(200).json(await settingService.getRouteDepot());
  } catch (error) {
    next(error);
  }
};

const updateRouteDepot = async (req, res, next) => {
  try {
    res.status(200).json(await settingService.updateRouteDepot(req.body, req.user?.Id ?? null));
  } catch (error) {
    next(error);
  }
};

export const settingController = {
  routes: [
    { method: "GET", url: "/contract-terms", middleware: [adminOnly, getContractTerms], authRequired: true },
    { method: "PUT", url: "/contract-terms", middleware: [adminOnly, updateContractTerms], authRequired: true },
    { method: "POST", url: "/contract-terms/preview", middleware: [adminOnly, previewContractTerms], authRequired: true },
    { method: "GET", url: "/route-depot", middleware: [adminOnly, getRouteDepot], authRequired: true },
    { method: "PUT", url: "/route-depot", middleware: [adminOnly, updateRouteDepot], authRequired: true }
  ]
};
