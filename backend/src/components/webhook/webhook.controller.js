import twilio from "twilio";
import * as consentService from "../consent/consent.service.js";
import * as notificationService from "../notification/notification.service.js";
import { verifyTwilioSignature } from "../../middlewares/verifyTwilioSignature.js";
import { publicRateLimit } from "../../middlewares/rateLimit.js";
import { CONSENT_METHODS, SUPPRESSION_REASONS } from "../consent/consent.constants.js";
import { CHANNELS } from "../notification/notification.constants.js";
import { logger } from "../../config/logger.js";

const STOP_KEYWORDS = ["STOP", "ARRET", "ARRÊT", "UNSUBSCRIBE", "DESABONNER", "DÉSABONNER"];
const START_KEYWORDS = ["START", "OUI", "YES", "UNSTOP"];

const normalizeKeyword = (body) =>
  String(body || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * Webhook SMS entrant Twilio: gère STOP/ARRET (désabonnement) et
 * START/OUI (ré-abonnement). Répond en TwiML.
 */
const incomingSms = async (req, res, next) => {
  try {
    const from = req.body.From;
    const keyword = normalizeKeyword(req.body.Body);
    const twiml = new twilio.twiml.MessagingResponse();

    if (STOP_KEYWORDS.includes(keyword)) {
      await consentService.suppressContact({
        channel: CHANNELS.SMS,
        address: from,
        reason: SUPPRESSION_REASONS.STOP_KEYWORD,
        method: CONSENT_METHODS.SMS_STOP,
        ipAddress: req.ip
      });
      twiml.message("Vous êtes désabonné des alertes de déneigement. Répondez OUI pour vous réabonner.");
    } else if (START_KEYWORDS.includes(keyword)) {
      await consentService.unsuppressContact({
        channel: CHANNELS.SMS,
        address: from,
        method: CONSENT_METHODS.SMS_START,
        ipAddress: req.ip
      });
      twiml.message("Vous êtes réabonné aux alertes de déneigement.");
    } else {
      logger.info(`SMS entrant non reconnu de ${from}: ${req.body.Body}`);
    }

    res.type("text/xml").send(twiml.toString());
  } catch (error) {
    next(error);
  }
};

/** Callback de statut Twilio: enrichit la livraison correspondante. */
const smsStatus = async (req, res, next) => {
  try {
    await notificationService.applyProviderStatus({
      providerMessageId: req.body.MessageSid,
      providerStatus: req.body.MessageStatus
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const webhookController = {
  routes: [
    {
      method: "POST",
      url: "/twilio/sms",
      middleware: [publicRateLimit, verifyTwilioSignature, incomingSms],
      authRequired: false
    },
    {
      method: "POST",
      url: "/twilio/status",
      middleware: [publicRateLimit, verifyTwilioSignature, smsStatus],
      authRequired: false
    }
  ]
};
