import * as consentService from "../consent/consent.service.js";
import { verifyUnsubscribeToken } from "../../notifications/MessageBuilder.js";
import { publicRateLimit } from "../../middlewares/rateLimit.js";
import { CONSENT_METHODS, SUPPRESSION_REASONS } from "../consent/consent.constants.js";
import { CHANNELS } from "../notification/notification.constants.js";
import { BadRequestError } from "../../errors/Errors.js";

/**
 * Validation du lien de désabonnement (GET depuis le courriel).
 * Le frontend appelle ceci pour vérifier le jeton avant d'afficher la
 * confirmation.
 */
const validateToken = async (req, res, next) => {
  try {
    const { e: email, t: token } = req.query;
    if (!email || !token || !verifyUnsubscribeToken(email, token)) {
      throw new BadRequestError("Lien de désabonnement invalide ou expiré.");
    }
    res.status(200).json({ valid: true, email });
  } catch (error) {
    next(error);
  }
};

/** Confirmation du désabonnement courriel. */
const confirm = async (req, res, next) => {
  try {
    const { email, token } = req.body;
    if (!email || !token || !verifyUnsubscribeToken(email, token)) {
      throw new BadRequestError("Lien de désabonnement invalide ou expiré.");
    }

    await consentService.suppressContact({
      channel: CHANNELS.EMAIL,
      address: email,
      reason: SUPPRESSION_REASONS.UNSUBSCRIBE_LINK,
      method: CONSENT_METHODS.EMAIL_UNSUBSCRIBE,
      ipAddress: req.ip
    });

    res.status(200).json({ unsubscribed: true });
  } catch (error) {
    next(error);
  }
};

export const unsubscribeController = {
  routes: [
    { method: "GET", url: "", middleware: [publicRateLimit, validateToken], authRequired: false },
    { method: "POST", url: "/confirm", middleware: [publicRateLimit, confirm], authRequired: false }
  ]
};
