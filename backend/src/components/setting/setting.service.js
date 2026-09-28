import db from "../../../models/index.js";
import { BadRequestError } from "../../errors/Errors.js";
import { logger } from "../../config/logger.js";
import { SETTING_KEYS } from "./setting.constants.js";
import { CONTRACT_TERMS_RULES, DEFAULT_CONTRACT_TERMS } from "../../documents/contractTerms.js";
import { buildContractPdf } from "../../documents/contractPdf.js";
import { computeTotals } from "../invoice/invoice.money.js";
import { keepLocationDateIfUnchanged, normalizeNamedLocation } from "../../shared/location.js";
import { DEFAULT_ROUTE_OPTIMIZATION_SETTINGS, ROUTE_OPTIMIZATION_LIMITS } from "../route/route.constants.js";
import { DEFAULT_TRACKING_SETTINGS, TRACKING_LIMITS } from "../tracking/tracking.constants.js";

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

/** Saison « courante » pour l'exemple : à partir de juillet, on prépare la saison qui commence cet automne. */
const sampleSeasonYear = (date) => (date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1);

const toDateOnly = (date) => date.toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

/**
 * Contrat d'exemple (client fictif, filigrane « EXEMPLE ») avec les valeurs
 * reçues, enregistrées ou non : l'admin voit le rendu avant de sauvegarder.
 * Rien n'est écrit en base.
 */
export const buildContractTermsPreview = async (input) => {
  const terms = validateContractTerms(input);
  const now = new Date();
  const year = sampleSeasonYear(now);
  const due = new Date(now);
  due.setDate(due.getDate() + 30);

  const totals = computeTotals([
    { Description: "Entrée double", Quantity: 1, UnitPrice: 400 },
    { Description: "Trottoir", Quantity: 1, UnitPrice: 60 }
  ]);
  const contract = {
    Reference: `${String(year).slice(-2)}-1000`,
    ContractNumber: 1000,
    SeasonStartYear: year,
    StartDate: `${year}-11-01`,
    EndDate: `${year + 1}-04-30`,
    Notes: "Pousser la neige à l'arrière.\nAttention au Tempo.",
    Client: { ClientNumber: 1000, FirstName: "Jean", LastName: "Exemple", Phone: "+18195550000", Email: "jean.exemple@exemple.ca" },
    ServiceAddress: { CivicNumber: "123", Street: "rue Exemple", City: "Sherbrooke", PostalCode: "J1H0A0" }
  };
  const invoice = {
    InvoiceNumber: `FAC-${now.getFullYear()}-EXEMPLE`,
    Lines: totals.lines,
    Subtotal: totals.subtotal,
    TpsAmount: totals.tps,
    TvqAmount: totals.tvq,
    Amount: totals.total
  };

  return buildContractPdf({
    contract,
    invoice,
    terms,
    issueDate: toDateOnly(now),
    dueDate: toDateOnly(due),
    watermark: "EXEMPLE"
  });
};

/* ------------------------------------------------------------------ */
/* Dépôt des routes                                                    */
/* ------------------------------------------------------------------ */

/** Dépôt par défaut (départ et retour des routes sans point d'attache propre). `value` null = pas encore configuré. */
export const getRouteDepot = async () => {
  const row = await Setting.findOne({ where: { Key: SETTING_KEYS.ROUTE_DEPOT } });
  return { value: row?.Value ?? null, updatedAt: row?.updatedAt ?? null };
};

export const updateRouteDepot = async (input, userId = null) => {
  const current = await Setting.findOne({ where: { Key: SETTING_KEYS.ROUTE_DEPOT } });
  const value = keepLocationDateIfUnchanged(normalizeNamedLocation(input, "Dépôt"), current?.Value);
  const [row] = await Setting.findOrCreate({
    where: { Key: SETTING_KEYS.ROUTE_DEPOT },
    defaults: { Value: value, UpdatedByUserId: userId }
  });
  row.Value = value;
  row.UpdatedByUserId = userId;
  row.changed("Value", true);
  await row.save();
  logger.info(`Dépôt des routes modifié | par utilisateur #${userId ?? "?"} | ${value.label}`);
  return getRouteDepot();
};

/* ------------------------------------------------------------------ */
/* Paramètres de l'optimiseur                                          */
/* ------------------------------------------------------------------ */

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Défauts du code, surchargés clé par clé par ce que l'admin a enregistré. */
const mergeOptimizationSettings = (stored = {}) => {
  const defaults = DEFAULT_ROUTE_OPTIMIZATION_SETTINGS;
  return {
    visitMinutesBySurface: { ...defaults.visitMinutesBySurface, ...pick(stored.visitMinutesBySurface, defaults.visitMinutesBySurface) },
    sizeFactors: { ...defaults.sizeFactors, ...pick(stored.sizeFactors, defaults.sizeFactors) },
    departureTime: stored.departureTime ?? defaults.departureTime
  };
};

/** Seulement les clés connues (une clé retirée du code disparaît d'elle-même). */
const pick = (values, reference) =>
  Object.fromEntries(Object.entries(values ?? {}).filter(([key]) => key in reference));

export const getRouteOptimizationSettings = async () => {
  const row = await Setting.findOne({ where: { Key: SETTING_KEYS.ROUTE_OPTIMIZATION } });
  return { values: mergeOptimizationSettings(row?.Value), defaults: DEFAULT_ROUTE_OPTIMIZATION_SETTINGS, updatedAt: row?.updatedAt ?? null };
};

const validateNumbers = (input, reference, { min, max }, label) => {
  const values = {};
  for (const key of Object.keys(reference)) {
    const number = Number(input?.[key]);
    if (input?.[key] === undefined || input?.[key] === null || input?.[key] === "" || !Number.isFinite(number) || number < min || number > max) {
      throw new BadRequestError(`${label} « ${key} » : doit être entre ${min} et ${max}.`);
    }
    values[key] = Math.round(number * 100) / 100;
  }
  return values;
};

export const updateRouteOptimizationSettings = async (input, userId = null) => {
  const defaults = DEFAULT_ROUTE_OPTIMIZATION_SETTINGS;
  const departureTime = String(input?.departureTime ?? "").trim();
  if (!TIME_PATTERN.test(departureTime)) {
    throw new BadRequestError("Heure de départ invalide (format HH:MM, ex. 03:30).");
  }
  const values = {
    visitMinutesBySurface: validateNumbers(input?.visitMinutesBySurface, defaults.visitMinutesBySurface, ROUTE_OPTIMIZATION_LIMITS.visitMinutes, "Durée"),
    sizeFactors: validateNumbers(input?.sizeFactors, defaults.sizeFactors, ROUTE_OPTIMIZATION_LIMITS.sizeFactor, "Facteur de taille"),
    departureTime
  };
  const [row] = await Setting.findOrCreate({
    where: { Key: SETTING_KEYS.ROUTE_OPTIMIZATION },
    defaults: { Value: values, UpdatedByUserId: userId }
  });
  row.Value = values;
  row.UpdatedByUserId = userId;
  row.changed("Value", true);
  await row.save();
  logger.info(`Paramètres de l'optimiseur modifiés | par utilisateur #${userId ?? "?"} | ${JSON.stringify(values)}`);
  return getRouteOptimizationSettings();
};

/* ------------------------------------------------------------------ */
/* Suivi des tracteurs (géolocalisation)                               */
/* ------------------------------------------------------------------ */

/** Défauts du code, surchargés clé par clé ; une clé ajoutée plus tard prend son défaut. */
export const getTrackingSettings = async () => {
  const row = await Setting.findOne({ where: { Key: SETTING_KEYS.TRACKING } });
  const values = { ...DEFAULT_TRACKING_SETTINGS, ...pick(row?.Value, DEFAULT_TRACKING_SETTINGS) };
  return { values, defaults: DEFAULT_TRACKING_SETTINGS, updatedAt: row?.updatedAt ?? null };
};

export const updateTrackingSettings = async (input, userId = null) => {
  const values = {};
  for (const [key, { min, max }] of Object.entries(TRACKING_LIMITS)) {
    const number = Number(input?.[key]);
    if (!Number.isInteger(number) || number < min || number > max) {
      throw new BadRequestError(`Suivi « ${key} » : doit être un entier entre ${min} et ${max}.`);
    }
    values[key] = number;
  }
  const [row] = await Setting.findOrCreate({
    where: { Key: SETTING_KEYS.TRACKING },
    defaults: { Value: values, UpdatedByUserId: userId }
  });
  row.Value = values;
  row.UpdatedByUserId = userId;
  row.changed("Value", true);
  await row.save();
  logger.info(`Paramètres du suivi modifiés | par utilisateur #${userId ?? "?"} | ${JSON.stringify(values)}`);
  return getTrackingSettings();
};
