import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import * as trackingService from "./tracking.service.js";
import { findVehicleByDeviceToken, hashDeviceToken } from "../vehicle/vehicle.service.js";
import { parseOsmAnd } from "../../tracking/osmandParser.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { UnauthorizedError } from "../../errors/Errors.js";
import { USER_ROLES } from "../user/user.constants.js";

const adminOnly = requireRole(USER_ROLES.ADMIN);
const operatorAccess = requireRole([USER_ROLES.ADMIN, USER_ROLES.OPERATOR]);

/**
 * Jeton de l'appareil : dans le chemin (/osmand/<jeton>) ou comme identifiant d'appareil
 * (champ « Identifiant » de Traccar Client). La 2e forme garde le jeton hors de l'URL en JSON.
 */
const deviceTokenOf = (req) => req.params.token || parseOsmAnd(req).deviceId;

/**
 * Par appareil (plusieurs tracteurs peuvent sortir par la même IP cellulaire).
 * Une position aux 5 s = 12/min ; 120/min laisse de la marge pour vider un tampon.
 */
const deviceRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const token = deviceTokenOf(req);
    return token ? `device:${hashDeviceToken(token)}` : `ip:${ipKeyGenerator(req.ip)}`;
  },
  message: { error: { message: "Trop de requêtes.", status: 429 } }
});

/** Réception OsmAnd (Traccar Client, ESP32). Ne jamais journaliser l'URL : elle peut contenir le jeton. */
const receiveOsmAnd = async (req, res, next) => {
  try {
    const { positions } = parseOsmAnd(req);
    const vehicle = await findVehicleByDeviceToken(deviceTokenOf(req));
    if (!vehicle) {
      throw new UnauthorizedError("Appareil non reconnu.");
    }
    const result = await trackingService.ingestDevicePositions(vehicle, positions);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const receiveBrowserPositions = async (req, res, next) => {
  try {
    res.status(200).json(await trackingService.ingestBrowserPositions(req.params.id, req.user, req.body?.positions));
  } catch (error) {
    next(error);
  }
};

const getLive = async (req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(await trackingService.getLiveRuns());
  } catch (error) {
    next(error);
  }
};

const getRunTrace = async (req, res, next) => {
  try {
    res.status(200).json(await trackingService.getRunTrace(req.params.id));
  } catch (error) {
    next(error);
  }
};

export const trackingController = {
  routes: [
    { method: "GET", url: "/osmand", middleware: [deviceRateLimit, receiveOsmAnd], authRequired: false },
    { method: "POST", url: "/osmand", middleware: [deviceRateLimit, receiveOsmAnd], authRequired: false },
    { method: "GET", url: "/osmand/:token", middleware: [deviceRateLimit, receiveOsmAnd], authRequired: false },
    { method: "POST", url: "/osmand/:token", middleware: [deviceRateLimit, receiveOsmAnd], authRequired: false },
    { method: "POST", url: "/runs/:id/positions", middleware: [operatorAccess, receiveBrowserPositions], authRequired: true },
    { method: "GET", url: "/live", middleware: [adminOnly, getLive], authRequired: true },
    { method: "GET", url: "/runs/:id", middleware: [adminOnly, getRunTrace], authRequired: true }
  ]
};
