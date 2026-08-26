import * as consentService from "./consent.service.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { USER_ROLES } from "../user/user.constants.js";
import { CONSENT_METHODS, SUPPRESSION_REASONS } from "./consent.constants.js";
import { BadRequestError } from "../../errors/Errors.js";
import { CHANNELS } from "../notification/notification.constants.js";

const adminOnly = requireRole(USER_ROLES.ADMIN);

const getLogs = async (req, res, next) => {
  try {
    res.status(200).json(await consentService.getConsentLogs({ address: req.query.address }));
  } catch (error) {
    next(error);
  }
};

const getSuppressed = async (req, res, next) => {
  try {
    res.status(200).json(await consentService.getSuppressedContacts());
  } catch (error) {
    next(error);
  }
};

const addSuppressed = async (req, res, next) => {
  try {
    const { channel, address } = req.body;
    if (![CHANNELS.SMS, CHANNELS.EMAIL].includes(channel) || !address) {
      throw new BadRequestError("channel (sms|email) et address sont requis.");
    }
    const result = await consentService.suppressContact({
      channel,
      address,
      reason: SUPPRESSION_REASONS.MANUAL,
      method: CONSENT_METHODS.ADMIN,
      actorUserId: req.user?.Id
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const removeSuppressed = async (req, res, next) => {
  try {
    const { channel, address } = req.body;
    if (![CHANNELS.SMS, CHANNELS.EMAIL].includes(channel) || !address) {
      throw new BadRequestError("channel (sms|email) et address sont requis.");
    }
    const result = await consentService.unsuppressContact({
      channel,
      address,
      method: CONSENT_METHODS.ADMIN,
      actorUserId: req.user?.Id
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const consentController = {
  routes: [
    { method: "GET", url: "/logs", middleware: [adminOnly, getLogs], authRequired: true },
    { method: "GET", url: "/suppressed", middleware: [adminOnly, getSuppressed], authRequired: true },
    { method: "POST", url: "/suppressed", middleware: [adminOnly, addSuppressed], authRequired: true },
    { method: "POST", url: "/suppressed/remove", middleware: [adminOnly, removeSuppressed], authRequired: true }
  ]
};
