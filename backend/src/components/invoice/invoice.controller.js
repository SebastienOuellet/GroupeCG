import * as invoiceService from "./invoice.service.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { USER_ROLES } from "../user/user.constants.js";
import { BadRequestError } from "../../errors/Errors.js";

const adminOnly = requireRole(USER_ROLES.ADMIN);

const getInvoices = async (req, res, next) => {
  try {
    const { contractId, clientId, type, status, year } = req.query;
    res.status(200).json(await invoiceService.getInvoices({ contractId, clientId, type, status, year }));
  } catch (error) {
    next(error);
  }
};

const getInvoiceById = async (req, res, next) => {
  try {
    res.status(200).json(await invoiceService.getInvoiceById(req.params.id));
  } catch (error) {
    next(error);
  }
};

/**
 * - { contractId }                         : montant à payer d'un contrat, généré depuis ses lignes
 * - { clientId, items, notes?, dueDate? }  : facture de service (travaux hors contrat)
 */
const createInvoice = async (req, res, next) => {
  try {
    const { contractId, clientId, items, notes, dueDate } = req.body;
    let invoice;
    if (contractId) {
      invoice = await invoiceService.createInvoiceFromContract(Number(contractId));
    } else if (clientId) {
      invoice = await invoiceService.createServiceInvoice({ clientId: Number(clientId), items, notes, dueDate });
    } else {
      throw new BadRequestError("contractId ou clientId est requis.");
    }
    res.status(201).json(await invoiceService.getInvoiceById(invoice.Id));
  } catch (error) {
    next(error);
  }
};

const updateInvoice = async (req, res, next) => {
  try {
    const { dueDate, notes, items } = req.body;
    const invoice = await invoiceService.updateInvoice(req.params.id, { dueDate, notes, items });
    res.status(200).json(await invoiceService.getInvoiceById(invoice.Id));
  } catch (error) {
    next(error);
  }
};

const sendInvoice = async (req, res, next) => {
  try {
    res.status(200).json(await invoiceService.sendInvoice(req.params.id, { dueDate: req.body?.dueDate }));
  } catch (error) {
    next(error);
  }
};

const markPaid = async (req, res, next) => {
  try {
    res.status(200).json(await invoiceService.markPaid(req.params.id));
  } catch (error) {
    next(error);
  }
};

const replaceInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.replaceInvoice(req.params.id);
    res.status(201).json(await invoiceService.getInvoiceById(invoice.Id));
  } catch (error) {
    next(error);
  }
};

const cancelInvoice = async (req, res, next) => {
  try {
    res.status(200).json(await invoiceService.cancelInvoice(req.params.id));
  } catch (error) {
    next(error);
  }
};

export const invoiceController = {
  routes: [
    { method: "GET", url: "", middleware: [adminOnly, getInvoices], authRequired: true },
    { method: "GET", url: "/:id", middleware: [adminOnly, getInvoiceById], authRequired: true },
    { method: "POST", url: "", middleware: [adminOnly, createInvoice], authRequired: true },
    { method: "POST", url: "/:id/send", middleware: [adminOnly, sendInvoice], authRequired: true },
    { method: "POST", url: "/:id/mark-paid", middleware: [adminOnly, markPaid], authRequired: true },
    { method: "POST", url: "/:id/replace", middleware: [adminOnly, replaceInvoice], authRequired: true },
    { method: "PUT", url: "/:id", middleware: [adminOnly, updateInvoice], authRequired: true },
    { method: "DELETE", url: "/:id", middleware: [adminOnly, cancelInvoice], authRequired: true }
  ]
};
