import * as contractService from "./contract.service.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { USER_ROLES } from "../user/user.constants.js";

const adminOnly = requireRole(USER_ROLES.ADMIN);

const getContracts = async (req, res, next) => {
  try {
    const { seasonYear, status, routeId, clientId } = req.query;
    const contracts = await contractService.getContracts({ seasonYear, status, routeId, clientId });
    res.status(200).json(contracts);
  } catch (error) {
    next(error);
  }
};

const getContractById = async (req, res, next) => {
  try {
    const contract = await contractService.getContractById(req.params.id);
    res.status(200).json(contract);
  } catch (error) {
    next(error);
  }
};

const createContract = async (req, res, next) => {
  try {
    const contract = await contractService.createContract(req.body);
    res.status(201).json(contract);
  } catch (error) {
    next(error);
  }
};

const updateContract = async (req, res, next) => {
  try {
    const contract = await contractService.updateContract(req.params.id, req.body);
    res.status(200).json(contract);
  } catch (error) {
    next(error);
  }
};

const cancelContract = async (req, res, next) => {
  try {
    const contract = await contractService.cancelContract(req.params.id);
    res.status(200).json(contract);
  } catch (error) {
    next(error);
  }
};

const rolloverSeason = async (req, res, next) => {
  try {
    const result = await contractService.rolloverSeason({ fromSeasonYear: req.body.fromSeasonYear });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const contractController = {
  routes: [
    { method: "GET", url: "", middleware: [adminOnly, getContracts], authRequired: true },
    { method: "GET", url: "/:id", middleware: [adminOnly, getContractById], authRequired: true },
    { method: "POST", url: "", middleware: [adminOnly, createContract], authRequired: true },
    { method: "POST", url: "/rollover", middleware: [adminOnly, rolloverSeason], authRequired: true },
    { method: "PUT", url: "/:id", middleware: [adminOnly, updateContract], authRequired: true },
    { method: "DELETE", url: "/:id", middleware: [adminOnly, cancelContract], authRequired: true }
  ]
};
