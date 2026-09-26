import db from "../../../models/index.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../errors/Errors.js";
import { logger } from "../../config/logger.js";
import { DEFAULT_PAYMENT_TERMS_DAYS, INVOICE_STATUS, INVOICE_TYPE } from "./invoice.constants.js";
import { computeTotals, normalizeLineItems } from "./invoice.money.js";
import { getContractTerms } from "../setting/setting.service.js";

const { Invoice, InvoiceLine, Contract, ContractItem, Client, sequelize, Sequelize } = db;
const { Op } = Sequelize;

/** Dates comptables à l'heure du Québec (toISOString() = UTC : le soir, on basculait au lendemain). */
const BUSINESS_TIMEZONE = "America/Toronto";
const toBusinessDate = (date) => date.toLocaleDateString("en-CA", { timeZone: BUSINESS_TIMEZONE });
export const today = () => toBusinessDate(new Date());
const addDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toBusinessDate(date);
};

/**
 * Numérotation FAC-YYYY-NNNN, séquence par année civile (année de création
 * de la facture, pas de la saison du contrat). Les factures annulées gardent
 * leur numéro : la séquence reste continue, sans trou, pour la comptabilité.
 */
const buildInvoiceNumber = async (year, transaction) => {
  const prefix = `FAC-${year}-`;
  const existing = await Invoice.findAll({
    where: { InvoiceNumber: { [Op.like]: `${prefix}%` } },
    attributes: ["InvoiceNumber"],
    transaction
  });

  const maxSeq = existing.reduce((max, invoice) => {
    const seq = parseInt(invoice.InvoiceNumber.slice(prefix.length), 10);
    return Number.isFinite(seq) && seq > max ? seq : max;
  }, 0);

  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
};

const linesInclude = { model: InvoiceLine, as: "Lines", separate: true, order: [["SortOrder", "ASC"]] };

const defaultInclude = [
  { model: Client, as: "Client" },
  { model: Contract, as: "Contract", include: [{ model: Client, as: "Client" }] },
  linesInclude,
  { model: Invoice, as: "ReplacesInvoice", attributes: ["Id", "InvoiceNumber"] }
];

export const getInvoices = async ({ contractId, clientId, type, status, year } = {}) => {
  const where = {};
  if (contractId) where.ContractId = contractId;
  if (clientId) where.ClientId = clientId;
  if (type) where.Type = type;
  if (status) where.Status = status;
  // Année comptable = date d'émission (envoi). Les brouillons n'ont pas d'année.
  if (year) where.IssuedAt = { [Op.between]: [`${Number(year)}-01-01`, `${Number(year)}-12-31`] };

  return Invoice.findAll({ where, include: defaultInclude, order: [["InvoiceNumber", "DESC"]] });
};

export const getInvoiceById = async (id, transaction) => {
  const invoice = await Invoice.findByPk(id, { include: defaultInclude, transaction });
  if (!invoice) {
    throw new NotFoundError("Facture introuvable.");
  }
  return invoice;
};

/** Facture « en cours » d'un contrat : la plus récente non annulée (au plus une). */
export const getActiveInvoiceForContract = async (contractId, transaction) =>
  Invoice.findOne({
    where: { ContractId: contractId, Type: INVOICE_TYPE.CONTRACT, Status: { [Op.ne]: INVOICE_STATUS.CANCELLED } },
    order: [["Id", "DESC"]],
    transaction
  });

const loadContractItems = async (contractId, transaction) => {
  const items = await ContractItem.findAll({
    where: { ContractId: contractId },
    order: [["SortOrder", "ASC"], ["Id", "ASC"]],
    transaction
  });
  if (items.length === 0) {
    throw new BadRequestError("Le contrat n'a aucune ligne à facturer.");
  }
  return items;
};

/** (Ré)écrit les lignes d'une facture et recalcule sous-total, taxes et total. */
const writeLines = async (invoice, items, transaction) => {
  const totals = computeTotals(items);

  await InvoiceLine.destroy({ where: { InvoiceId: invoice.Id }, transaction });
  await InvoiceLine.bulkCreate(
    totals.lines.map((line) => ({ ...line, InvoiceId: invoice.Id })),
    { transaction }
  );

  invoice.Subtotal = totals.subtotal;
  invoice.TpsAmount = totals.tps;
  invoice.TvqAmount = totals.tvq;
  invoice.Amount = totals.total;
  await invoice.save({ transaction });
  return invoice;
};

const applyContractItems = async (invoice, contractId, transaction) =>
  writeLines(invoice, await loadContractItems(contractId, transaction), transaction);

/**
 * Génère la facture brouillon d'un contrat à partir de ses lignes.
 * Refuse s'il existe déjà une facture non annulée (une facture par contrat).
 * S'exécute dans la transaction de l'appelant si fournie.
 */
export const createInvoiceFromContract = async (contractId, { transaction, replacesInvoiceId = null, notes = null } = {}) => {
  const run = async (t) => {
    const contract = await Contract.findByPk(contractId, { transaction: t });
    if (!contract) {
      throw new NotFoundError("Contrat introuvable.");
    }

    const active = await getActiveInvoiceForContract(contractId, t);
    if (active) {
      throw new ConflictError(`Le contrat ${contract.Reference} a déjà une facture en cours (${active.InvoiceNumber}).`);
    }

    const invoice = await Invoice.create(
      {
        Type: INVOICE_TYPE.CONTRACT,
        ClientId: contract.ClientId,
        ContractId: contractId,
        InvoiceNumber: await buildInvoiceNumber(new Date().getFullYear(), t),
        Amount: 0,
        Status: INVOICE_STATUS.DRAFT,
        ReplacesInvoiceId: replacesInvoiceId,
        Notes: notes
      },
      { transaction: t }
    );
    await applyContractItems(invoice, contractId, t);

    logger.info(`Facture créée | ${invoice.InvoiceNumber} - contrat ${contract.Reference} - ${invoice.Amount}$ TTC`);
    return invoice;
  };

  return transaction ? run(transaction) : sequelize.transaction(run);
};

/**
 * Facture de service : travaux ponctuels hors contrat (ex. déneigement de
 * toiture en mars). Lignes saisies à la main, brouillon modifiable jusqu'à l'envoi.
 */
export const createServiceInvoice = async ({ clientId, items, notes, dueDate }) => {
  if (!clientId) {
    throw new BadRequestError("clientId est requis.");
  }
  const lines = normalizeLineItems(items);

  return sequelize.transaction(async (transaction) => {
    const client = await Client.findByPk(clientId, { transaction });
    if (!client) {
      throw new NotFoundError("Client introuvable.");
    }
    const invoice = await Invoice.create(
      {
        Type: INVOICE_TYPE.SERVICE,
        ClientId: client.Id,
        ContractId: null,
        InvoiceNumber: await buildInvoiceNumber(new Date().getFullYear(), transaction),
        Amount: 0,
        Status: INVOICE_STATUS.DRAFT,
        DueDate: dueDate || null,
        Notes: notes || null
      },
      { transaction }
    );
    await writeLines(invoice, lines, transaction);
    logger.info(`Facture de service créée | ${invoice.InvoiceNumber} - client #${client.ClientNumber} - ${invoice.Amount}$ TTC`);
    return invoice;
  });
};

/** Brouillon seulement : réaligne la facture sur les lignes actuelles du contrat. */
export const refreshDraftFromContract = async (invoice, transaction) => {
  if (invoice.Status !== INVOICE_STATUS.DRAFT) {
    throw new ConflictError(`La facture ${invoice.InvoiceNumber} a été envoyée : elle ne peut plus être modifiée. Annulez-la et remplacez-la.`);
  }
  await applyContractItems(invoice, invoice.ContractId, transaction);
  logger.info(`Facture brouillon mise à jour | ${invoice.InvoiceNumber} - ${invoice.Amount}$ TTC`);
  return invoice;
};

const assertCancellable = (invoice) => {
  if (invoice.Status === INVOICE_STATUS.CANCELLED) {
    throw new ConflictError(`La facture ${invoice.InvoiceNumber} est déjà annulée.`);
  }
  if (invoice.Status === INVOICE_STATUS.PAID) {
    throw new ConflictError(`La facture ${invoice.InvoiceNumber} est payée : elle ne peut pas être annulée.`);
  }
};

const markCancelled = async (invoice, transaction) => {
  invoice.Status = INVOICE_STATUS.CANCELLED;
  invoice.CancelledAt = today();
  await invoice.save({ transaction });
  logger.info(`Facture annulée | ${invoice.InvoiceNumber}`);
  return invoice;
};

/**
 * Annule une facture envoyée et en génère une nouvelle (brouillon) à partir
 * des lignes actuelles du contrat. L'ancienne garde son numéro, statut annulé.
 */
export const replaceInvoice = async (id, { transaction } = {}) => {
  const run = async (t) => {
    const invoice = await Invoice.findByPk(id, { transaction: t });
    if (!invoice) {
      throw new NotFoundError("Facture introuvable.");
    }
    if (invoice.Type !== INVOICE_TYPE.CONTRACT) {
      throw new BadRequestError("Seul le montant d'un contrat se remplace. Pour une facture de service, annulez-la et créez-en une nouvelle.");
    }
    assertCancellable(invoice);
    await markCancelled(invoice, t);
    return createInvoiceFromContract(invoice.ContractId, {
      transaction: t,
      replacesInvoiceId: invoice.Id,
      notes: `Remplace ${invoice.InvoiceNumber}`
    });
  };

  return transaction ? run(transaction) : sequelize.transaction(run);
};

/**
 * Contenu figé une fois envoyée ; seules les notes internes restent modifiables.
 * Les lignes ne se modifient ici que pour une facture de SERVICE en brouillon
 * (celles d'un contrat suivent le contrat).
 */
export const updateInvoice = async (id, { dueDate, notes, items }) => {
  const invoice = await getInvoiceById(id);

  if (items !== undefined) {
    if (invoice.Type !== INVOICE_TYPE.SERVICE) {
      throw new BadRequestError("Les lignes d'une facture de contrat se modifient depuis le contrat.");
    }
    if (invoice.Status !== INVOICE_STATUS.DRAFT) {
      throw new ConflictError(`La facture ${invoice.InvoiceNumber} a été envoyée : elle ne peut plus être modifiée.`);
    }
    const lines = normalizeLineItems(items);
    await sequelize.transaction((transaction) => writeLines(invoice, lines, transaction));
  }

  if (dueDate !== undefined) {
    if (invoice.Status !== INVOICE_STATUS.DRAFT) {
      throw new ConflictError("L'échéance d'une facture envoyée ne peut plus être modifiée.");
    }
    invoice.DueDate = dueDate || null;
  }
  if (notes !== undefined) invoice.Notes = notes || null;

  await invoice.save();
  return invoice;
};

/** Échéance appliquée à l'envoi : celle demandée, sinon celle du brouillon, sinon délai par défaut. */
export const resolveDueDate = (invoice, dueDate) => dueDate || invoice.DueDate || addDays(DEFAULT_PAYMENT_TERMS_DAYS);

/** Fige les conditions actuelles (Paramètres › Contrat) sur le paiement d'un contrat qui part chez le client. */
const freezeTerms = async (invoice) => {
  if (invoice.Type === INVOICE_TYPE.CONTRACT && !invoice.TermsSnapshot) {
    invoice.TermsSnapshot = (await getContractTerms()).values;
  }
};

export const sendInvoice = async (id, { dueDate, sentToEmail = null } = {}) => {
  const invoice = await getInvoiceById(id);
  if (invoice.Status !== INVOICE_STATUS.DRAFT) {
    throw new ConflictError(`La facture ${invoice.InvoiceNumber} n'est pas un brouillon.`);
  }
  invoice.Status = INVOICE_STATUS.SENT;
  invoice.IssuedAt = today();
  invoice.DueDate = resolveDueDate(invoice, dueDate);
  invoice.SentToEmail = sentToEmail;
  await freezeTerms(invoice);
  await invoice.save();
  logger.info(`Facture marquée envoyée | ${invoice.InvoiceNumber}${sentToEmail ? ` | par courriel à ${sentToEmail}` : ""}`);
  return invoice;
};

export const markPaid = async (id) => {
  const invoice = await getInvoiceById(id);
  if (invoice.Status === INVOICE_STATUS.PAID || invoice.Status === INVOICE_STATUS.CANCELLED) {
    throw new ConflictError(`La facture ${invoice.InvoiceNumber} est déjà ${invoice.Status === INVOICE_STATUS.PAID ? "payée" : "annulée"}.`);
  }
  // Payée directement depuis un brouillon (ex. comptant) : elle est émise aujourd'hui.
  if (!invoice.IssuedAt) invoice.IssuedAt = today();
  await freezeTerms(invoice);
  invoice.Status = INVOICE_STATUS.PAID;
  invoice.PaidAt = today();
  await invoice.save();
  logger.info(`Facture marquée payée | ${invoice.InvoiceNumber}`);
  return invoice;
};

export const cancelInvoice = async (id, { transaction } = {}) => {
  const invoice = await Invoice.findByPk(id, { transaction });
  if (!invoice) {
    throw new NotFoundError("Facture introuvable.");
  }
  assertCancellable(invoice);
  return markCancelled(invoice, transaction);
};
