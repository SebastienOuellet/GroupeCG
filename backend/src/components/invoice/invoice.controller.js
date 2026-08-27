import * as invoiceService from "./invoice.service.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { USER_ROLES } from "../user/user.constants.js";

const adminOnly = requireRole(USER_ROLES.ADMIN);

const getInvoices = async (req, res, next) => {
  try {
    const { contractId, status } = req.query;
    res.status(200).json(await invoiceService.getInvoices({ contractId, status }));
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

const createInvoice = async (req, res, next) => {
  try {
    const { contractId, amount, dueDate, notes, status } = req.body;
    res.status(201).json(await invoiceService.createInvoice({ contractId, amount, dueDate, notes, status }));
  } catch (error) {
    next(error);
  }
};

const updateInvoice = async (req, res, next) => {
  try {
    res.status(200).json(await invoiceService.updateInvoice(req.params.id, req.body));
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
    { method: "POST", url: "/:id/mark-paid", middleware: [adminOnly, markPaid], authRequired: true },
    { method: "PUT", url: "/:id", middleware: [adminOnly, updateInvoice], authRequired: true },
    { method: "DELETE", url: "/:id", middleware: [adminOnly, cancelInvoice], authRequired: true }
  ]
};
