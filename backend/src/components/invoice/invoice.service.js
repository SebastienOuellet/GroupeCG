import db from "../../../models/index.js";
import { BadRequestError, NotFoundError } from "../../errors/Errors.js";
import { logger } from "../../config/logger.js";
import { INVOICE_STATUS } from "./invoice.constants.js";

const { Invoice, Contract, Client, sequelize, Sequelize } = db;
const { Op } = Sequelize;

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Numérotation FAC-YYYY-NNNN, séquence par année civile (année de création
 * de la facture, pas de la saison du contrat).
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

const defaultInclude = [
  { model: Contract, as: "Contract", include: [{ model: Client, as: "Client" }] }
];

export const getInvoices = async ({ contractId, status } = {}) => {
  const where = {};
  if (contractId) where.ContractId = contractId;
  if (status) where.Status = status;

  return Invoice.findAll({ where, include: defaultInclude, order: [["InvoiceNumber", "DESC"]] });
};

export const getInvoiceById = async (id) => {
  const invoice = await Invoice.findByPk(id, { include: defaultInclude });
  if (!invoice) {
    throw new NotFoundError("Facture introuvable.");
  }
  return invoice;
};

export const createInvoice = async ({ contractId, amount, dueDate, notes, status }) => {
  if (!contractId || !amount) {
    throw new BadRequestError("contractId et amount sont requis.");
  }

  return sequelize.transaction(async (transaction) => {
    const contract = await Contract.findByPk(contractId, { transaction });
    if (!contract) {
      throw new NotFoundError("Contrat introuvable.");
    }

    const year = new Date().getFullYear();
    const invoiceNumber = await buildInvoiceNumber(year, transaction);
    const initialStatus = status || INVOICE_STATUS.DRAFT;

    const invoice = await Invoice.create(
      {
        ContractId: contractId,
        InvoiceNumber: invoiceNumber,
        Amount: amount,
        Status: initialStatus,
        DueDate: dueDate || null,
        IssuedAt: initialStatus === INVOICE_STATUS.SENT ? today() : null,
        Notes: notes || null
      },
      { transaction }
    );

    logger.info(`Facture créée | ${invoice.InvoiceNumber} - contrat ${contract.Reference} - ${amount}$`);
    return invoice;
  });
};

export const updateInvoice = async (id, { amount, dueDate, notes, status }) => {
  const invoice = await getInvoiceById(id);

  if (amount !== undefined) invoice.Amount = amount;
  if (dueDate !== undefined) invoice.DueDate = dueDate;
  if (notes !== undefined) invoice.Notes = notes;

  if (status && status !== invoice.Status) {
    if (status === INVOICE_STATUS.SENT && !invoice.IssuedAt) {
      invoice.IssuedAt = today();
    }
    if (status === INVOICE_STATUS.PAID && !invoice.PaidAt) {
      invoice.PaidAt = today();
    }
    invoice.Status = status;
  }

  await invoice.save();
  return invoice;
};

export const markPaid = async (id) => {
  const invoice = await getInvoiceById(id);
  invoice.Status = INVOICE_STATUS.PAID;
  invoice.PaidAt = today();
  await invoice.save();
  logger.info(`Facture marquée payée | ${invoice.InvoiceNumber}`);
  return invoice;
};

export const cancelInvoice = async (id) => {
  const invoice = await getInvoiceById(id);
  invoice.Status = INVOICE_STATUS.CANCELLED;
  await invoice.save();
  return invoice;
};
