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

export const settingController = {
  routes: [
    { method: "GET", url: "/contract-terms", middleware: [adminOnly, getContractTerms], authRequired: true },
    { method: "PUT", url: "/contract-terms", middleware: [adminOnly, updateContractTerms], authRequired: true }
  ]
};
