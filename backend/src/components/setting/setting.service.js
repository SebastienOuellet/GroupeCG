import db from "../../../models/index.js";
import { BadRequestError } from "../../errors/Errors.js";
import { logger } from "../../config/logger.js";
import { SETTING_KEYS } from "./setting.constants.js";
import { CONTRACT_TERMS_RULES, DEFAULT_CONTRACT_TERMS } from "../../documents/contractTerms.js";

const { Setting } = db;

/** Jours par mois (février à 28 : la date limite revient chaque année). */
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Valeurs des conditions du contrat : défauts du code, surchargés par ce que
 * l'admin a enregistré. Une valeur ajoutée plus tard au code prend son défaut
 * automatiquement tant que l'admin ne l'a pas modifiée.
 */
export const getContractTerms = async () => {
  const row = await Setting.findOne({ where: { Key: SETTING_KEYS.CONTRACT_TERMS } });
  const stored = row?.Value ?? {};
  const values = { ...DEFAULT_CONTRACT_TERMS };
  for (const key of Object.keys(DEFAULT_CONTRACT_TERMS)) {
    if (stored[key] !== undefined) values[key] = stored[key];
  }
  return { values, defaults: DEFAULT_CONTRACT_TERMS, updatedAt: row?.updatedAt ?? null };
};

const validateContractTerms = (input) => {
  const values = {};
  for (const [key, rule] of Object.entries(CONTRACT_TERMS_RULES)) {
    const raw = input?.[key];
    const number = Number(raw);
    if (raw === undefined || raw === null || raw === "" || !Number.isFinite(number)) {
      throw new BadRequestError(`${rule.label} : valeur manquante ou invalide.`);
    }
    if (number < rule.min || number > rule.max) {
      throw new BadRequestError(`${rule.label} : doit être entre ${rule.min} et ${rule.max}.`);
    }
    if (rule.integer && !Number.isInteger(number)) {
      throw new BadRequestError(`${rule.label} : doit être un nombre entier.`);
    }
    values[key] = rule.integer ? number : Math.round(number * 100) / 100;
  }

  if (values.signatureDeadlineDay > DAYS_IN_MONTH[values.signatureDeadlineMonth - 1]) {
    throw new BadRequestError("La date limite de signature n'existe pas (jour trop grand pour ce mois).");
  }
  if (values.regionalAverageCm > values.maxSnowfallCm) {
    throw new BadRequestError("La moyenne régionale ne peut pas dépasser le maximum couvert par le contrat.");
  }
  return values;
};

export const updateContractTerms = async (input, userId = null) => {
  const values = validateContractTerms(input);
  const [row] = await Setting.findOrCreate({
    where: { Key: SETTING_KEYS.CONTRACT_TERMS },
    defaults: { Value: values, UpdatedByUserId: userId }
  });
  row.Value = values;
  row.UpdatedByUserId = userId;
  row.changed("Value", true);
  await row.save();
  logger.info(`Conditions du contrat modifiées | par utilisateur #${userId ?? "?"} | ${JSON.stringify(values)}`);
  return getContractTerms();
};
