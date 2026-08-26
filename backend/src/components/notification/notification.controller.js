import * as notificationService from "./notification.service.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { USER_ROLES } from "../user/user.constants.js";
import { BATCH_TYPES } from "./notification.constants.js";

const adminOnly = requireRole(USER_ROLES.ADMIN);

const send = async (req, res, next) => {
  try {
    const { targetType, targetId, templateId, smsBody, emailSubject, emailBody, useSms, useEmail } = req.body;
    const batch = await notificationService.enqueueBatch({
      type: BATCH_TYPES.MANUAL,
      targetType,
      targetId,
      templateId,
      smsBody,
      emailSubject,
      emailBody,
      useSms: !!useSms,
      useEmail: !!useEmail,
      createdByUserId: req.user?.Id || null
    });
    res.status(201).json(batch);
  } catch (error) {
    next(error);
  }
};

const getBatches = async (req, res, next) => {
  try {
    res.status(200).json(await notificationService.getBatches());
  } catch (error) {
    next(error);
  }
};

const getBatchById = async (req, res, next) => {
  try {
    res.status(200).json(await notificationService.getBatchById(req.params.id));
  } catch (error) {
    next(error);
  }
};

const getBatchDeliveries = async (req, res, next) => {
  try {
    res.status(200).json(await notificationService.getBatchDeliveries(req.params.id));
  } catch (error) {
    next(error);
  }
};

export const notificationController = {
  routes: [
    { method: "POST", url: "/send", middleware: [adminOnly, send], authRequired: true },
    { method: "GET", url: "/batches", middleware: [adminOnly, getBatches], authRequired: true },
    { method: "GET", url: "/batches/:id", middleware: [adminOnly, getBatchById], authRequired: true },
    { method: "GET", url: "/batches/:id/deliveries", middleware: [adminOnly, getBatchDeliveries], authRequired: true }
  ]
};
