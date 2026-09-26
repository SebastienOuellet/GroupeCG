import db from "../../../models/index.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../errors/Errors.js";
import { CONTRACT_STATUS } from "./contract.constants.js";
import { logger } from "../../config/logger.js";
import { buildContractPdf } from "../../documents/contractPdf.js";
import { buildContractEmail } from "../../documents/contractEmail.js";
import { getContractEmailProvider, isContractEmailLive } from "../../notifications/providerFactory.js";
import { getContractTerms } from "../setting/setting.service.js";
import * as invoiceService from "../invoice/invoice.service.js";
import { CONTRACT_INVOICE_ACTION, CONTRACT_INVOICE_ACTIONS, INVOICE_ISSUED_STATUSES, INVOICE_STATUS, INVOICE_TYPE } from "../invoice/invoice.constants.js";
import { computeTotals, normalizeLineItems } from "../invoice/invoice.money.js";

const { Contract, ContractItem, Client, ServiceAddress, Route, Invoice, InvoiceLine, sequelize, Sequelize } = db;
const { Op } = Sequelize;

const DEFAULT_ITEM_DESCRIPTION = "Déneigement saisonnier";
const MAX_ITEM_SUGGESTIONS = 50;

/** Rétrocompatibilité API : sans `Items` mais avec `Price`, une ligne unique « Déneigement saisonnier ». */
const normalizeItems = (items, fallbackPrice) => {
  if (items === undefined && fallbackPrice !== undefined && fallbackPrice !== null && fallbackPrice !== "") {
    items = [{ Description: DEFAULT_ITEM_DESCRIPTION, Quantity: 1, UnitPrice: fallbackPrice }];
  }
  return normalizeLineItems(items, "Le contrat doit contenir au moins une ligne.");
};

const itemsDiffer = (current, next) =>
  current.length !== next.length ||
  current.some((item, i) =>
    item.Description !== next[i].Description ||
    Number(item.Quantity) !== Number(next[i].Quantity) ||
    Number(item.UnitPrice) !== Number(next[i].UnitPrice)
  );

const replaceItems = async (contract, items, transaction) => {
  await ContractItem.destroy({ where: { ContractId: contract.Id }, transaction });
  await ContractItem.bulkCreate(items.map((item) => ({ ...item, ContractId: contract.Id })), { transaction });
  contract.Price = computeTotals(items).subtotal;
};

/**
 * Construit la référence FolloSOFT `YY-XXXX` : 2 derniers chiffres de l'année
 * de début de saison + numéro stable du client. Si le client a déjà un contrat
 * cette saison (multi-adresses), suffixe incrémental: `26-1001-2`, `26-1001-3`.
 */
const buildReference = async (seasonStartYear, clientNumber, transaction) => {
  const base = `${String(seasonStartYear).slice(-2)}-${clientNumber}`;
  const existing = await Contract.count({
    where: { Reference: { [Op.or]: [base, { [Op.like]: `${base}-%` }] } },
    transaction
  });
  return existing === 0 ? base : `${base}-${existing + 1}`;
};

const nextContractNumber = async (transaction) => {
  const max = await Contract.max("ContractNumber", { transaction });
  return (max || 0) + 1;
};

const defaultInclude = [
  { model: Client, as: "Client" },
  { model: ServiceAddress, as: "ServiceAddress" },
  { model: Route, as: "Route" }
];

const itemsInclude = { model: ContractItem, as: "Items", separate: true, order: [["SortOrder", "ASC"], ["Id", "ASC"]] };

export const getContracts = async ({ seasonYear, status, routeId, clientId } = {}) => {
  const where = {};
  if (seasonYear) where.SeasonStartYear = Number(seasonYear);
  if (status) where.Status = status;
  if (routeId) where.RouteId = routeId;
  if (clientId) where.ClientId = clientId;

  return Contract.findAll({
    where,
    // Paiements (non annulés) : la liste affiche le même montant figé que la fiche
    include: [
      ...defaultInclude,
      {
        model: Invoice,
        as: "Invoices",
        attributes: ["Id", "Status", "Amount"],
        where: { Type: INVOICE_TYPE.CONTRACT, Status: { [Op.ne]: INVOICE_STATUS.CANCELLED } },
        required: false
      }
    ],
    order: [["Reference", "ASC"]]
  });
};

export const getContractById = async (id, transaction) => {
  const contract = await Contract.findByPk(id, { include: [...defaultInclude, itemsInclude], transaction });
  if (!contract) {
    throw new NotFoundError("Contrat introuvable.");
  }
  return contract;
};

export const createContract = async (contractInfo) => {
  const { ClientId, ServiceAddressId, SeasonStartYear } = contractInfo;
  if (!ClientId || !ServiceAddressId || !SeasonStartYear) {
    throw new BadRequestError("ClientId, ServiceAddressId et SeasonStartYear sont requis.");
  }
  const items = normalizeItems(contractInfo.Items, contractInfo.Price);

  return sequelize.transaction(async (transaction) => {
    const client = await Client.findByPk(ClientId, { transaction });
    if (!client) {
      throw new NotFoundError("Client introuvable.");
    }

    const address = await ServiceAddress.findByPk(ServiceAddressId, { transaction });
    if (!address || address.ClientId !== client.Id) {
      throw new BadRequestError("L'adresse de service n'appartient pas à ce client.");
    }

    const duplicate = await Contract.findOne({
      where: { ServiceAddressId, SeasonStartYear },
      transaction
    });
    if (duplicate) {
      throw new ConflictError(`Un contrat existe déjà pour cette adresse en saison ${SeasonStartYear} (${duplicate.Reference}).`);
    }

    const reference = await buildReference(SeasonStartYear, client.ClientNumber, transaction);
    const contractNumber = await nextContractNumber(transaction);

    const { Id, Items, RenewalNoticeSentAt, ...fields } = contractInfo;
    const contract = await Contract.create(
      {
        ...fields,
        Reference: reference,
        ContractNumber: contractNumber,
        Price: computeTotals(items).subtotal
      },
      { transaction }
    );
    await ContractItem.bulkCreate(items.map((item) => ({ ...item, ContractId: contract.Id })), { transaction });

    // La facture (brouillon) naît avec le contrat : elle est prête à envoyer.
    if (contract.Status !== CONTRACT_STATUS.CANCELLED) {
      await invoiceService.createInvoiceFromContract(contract.Id, { transaction });
    }

    logger.info(`Nouveau contrat créé | ${contract.Reference} (#${contract.ContractNumber}) - client #${client.ClientNumber}`);
    return getContractById(contract.Id, transaction);
  });
};

/**
 * Modifie un contrat et, au besoin, sa facture en cours.
 *
 * `invoiceAction` (choix de l'utilisateur quand les lignes changent) :
 *  - "update"  : facture brouillon → réalignée sur les nouvelles lignes
 *  - "replace" : facture envoyée   → annulée + nouvelle facture brouillon
 *  - "none"    : facture laissée telle quelle (défaut)
 * Une facture payée n'est jamais touchée.
 *
 * Règles automatiques : contrat activé sans facture → facture générée ;
 * contrat annulé → facture brouillon annulée (une facture envoyée reste, à régler à la main).
 *
 * Retourne le contrat + `InvoiceSync` { action, invoiceNumber } pour informer l'interface.
 */
export const updateContract = async (id, contractInfo) => {
  const invoiceAction = contractInfo.invoiceAction ?? CONTRACT_INVOICE_ACTION.NONE;
  if (!CONTRACT_INVOICE_ACTIONS.includes(invoiceAction)) {
    throw new BadRequestError(`invoiceAction invalide : ${invoiceAction}.`);
  }

  return sequelize.transaction(async (transaction) => {
    const contract = await Contract.findByPk(id, { transaction });
    if (!contract) {
      throw new NotFoundError("Contrat introuvable.");
    }

    // Référence, numéro et rattachements structurants sont immuables ; Price est dérivé des lignes
    const { Id, Reference, ContractNumber, ClientId, SeasonStartYear, Price, Items, invoiceAction: _action, ...updatable } = contractInfo;
    const previousStatus = contract.Status;
    Object.assign(contract, updatable);

    let itemsChanged = false;
    if (Items !== undefined) {
      const items = normalizeItems(Items);
      const current = await ContractItem.findAll({ where: { ContractId: contract.Id }, order: [["SortOrder", "ASC"], ["Id", "ASC"]], transaction });
      itemsChanged = itemsDiffer(current, items);
      if (itemsChanged) await replaceItems(contract, items, transaction);
    }
    await contract.save({ transaction });

    let invoice = await invoiceService.getActiveInvoiceForContract(contract.Id, transaction);
    let action = "unchanged";

    if (contract.Status === CONTRACT_STATUS.CANCELLED && previousStatus !== CONTRACT_STATUS.CANCELLED) {
      if (invoice?.Status === INVOICE_STATUS.DRAFT) {
        await invoiceService.cancelInvoice(invoice.Id, { transaction });
        action = "cancelled";
      }
    } else if (!invoice && contract.Status === CONTRACT_STATUS.ACTIVE) {
      invoice = await invoiceService.createInvoiceFromContract(contract.Id, { transaction });
      action = "created";
    } else if (invoice && itemsChanged) {
      if (invoiceAction === CONTRACT_INVOICE_ACTION.UPDATE) {
        await invoiceService.refreshDraftFromContract(invoice, transaction);
        action = "updated";
      } else if (invoiceAction === CONTRACT_INVOICE_ACTION.REPLACE) {
        if (!INVOICE_ISSUED_STATUSES.includes(invoice.Status)) {
          throw new ConflictError(`La facture ${invoice.InvoiceNumber} ne peut pas être remplacée (statut : ${invoice.Status}).`);
        }
        invoice = await invoiceService.replaceInvoice(invoice.Id, { transaction });
        action = "replaced";
      }
    }

    const result = (await getContractById(contract.Id, transaction)).toJSON();
    result.InvoiceSync = { action, invoiceNumber: invoice?.InvoiceNumber ?? null };
    return result;
  });
};

/** Descriptions déjà utilisées, les plus fréquentes d'abord (autocomplétion des lignes). */
export const getItemSuggestions = async () => {
  const rows = await ContractItem.findAll({
    attributes: ["Description", [sequelize.fn("COUNT", sequelize.col("Id")), "uses"]],
    group: ["Description"],
    order: [[sequelize.literal("uses"), "DESC"], ["Description", "ASC"]],
    limit: MAX_ITEM_SUGGESTIONS,
    raw: true
  });
  return rows.map((row) => row.Description);
};

export const cancelContract = async (id) => {
  return sequelize.transaction(async (transaction) => {
    const contract = await Contract.findByPk(id, { transaction });
    if (!contract) {
      throw new NotFoundError("Contrat introuvable.");
    }
    contract.Status = CONTRACT_STATUS.CANCELLED;
    await contract.save({ transaction });

    const invoice = await invoiceService.getActiveInvoiceForContract(contract.Id, transaction);
    if (invoice?.Status === INVOICE_STATUS.DRAFT) {
      await invoiceService.cancelInvoice(invoice.Id, { transaction });
    }
    logger.info(`Contrat annulé | ${contract.Reference}`);
    return contract;
  });
};

/**
 * Roulement de saison: chaque contrat actif de la saison source engendre un
 * contrat `draft` pour la saison suivante (même adresse, même route, prix
 * reporté), avec sa nouvelle référence et son nouveau numéro.
 */
export const rolloverSeason = async ({ fromSeasonYear }) => {
  if (!fromSeasonYear) {
    throw new BadRequestError("fromSeasonYear est requis.");
  }
  const sourceYear = Number(fromSeasonYear);
  const targetYear = sourceYear + 1;

  return sequelize.transaction(async (transaction) => {
    const activeContracts = await Contract.findAll({
      where: { SeasonStartYear: sourceYear, Status: CONTRACT_STATUS.ACTIVE },
      include: [{ model: Client, as: "Client" }, itemsInclude],
      order: [["Reference", "ASC"]],
      transaction
    });

    const created = [];
    const skipped = [];

    for (const source of activeContracts) {
      const existing = await Contract.findOne({
        where: { ServiceAddressId: source.ServiceAddressId, SeasonStartYear: targetYear },
        transaction
      });
      if (existing) {
        skipped.push({ reference: source.Reference, reason: `déjà roulé (${existing.Reference})` });
        continue;
      }

      const reference = await buildReference(targetYear, source.Client.ClientNumber, transaction);
      const contractNumber = await nextContractNumber(transaction);

      const newContract = await Contract.create(
        {
          Reference: reference,
          ContractNumber: contractNumber,
          ClientId: source.ClientId,
          ServiceAddressId: source.ServiceAddressId,
          RouteId: source.RouteId,
          SeasonStartYear: targetYear,
          StartDate: shiftDateOneYear(source.StartDate),
          EndDate: shiftDateOneYear(source.EndDate),
          Price: source.Price,
          Status: CONTRACT_STATUS.DRAFT,
          RenewedFromContractId: source.Id
        },
        { transaction }
      );
      // Lignes reportées telles quelles ; la facture viendra à l'activation du contrat.
      await ContractItem.bulkCreate(
        source.Items.map(({ Description, Quantity, UnitPrice, SortOrder }) => ({ ContractId: newContract.Id, Description, Quantity, UnitPrice, SortOrder })),
        { transaction }
      );
      created.push(newContract);
    }

    logger.info(`Roulement de saison ${sourceYear} → ${targetYear} | ${created.length} créés, ${skipped.length} ignorés`);
    return { targetYear, createdCount: created.length, skipped, created };
  });
};

const shiftDateOneYear = (dateOnly) => {
  const [year, month, day] = String(dateOnly).split("-").map(Number);
  return `${year + 1}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

/* ------------------------------------------------------------------ */
/* Document PDF du contrat (le contrat fait office de facture)         */
/* ------------------------------------------------------------------ */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const loadForDocument = async (id) => {
  const contract = await Contract.findByPk(id, {
    include: [
      { model: Client, as: "Client" },
      { model: ServiceAddress, as: "ServiceAddress" }
    ]
  });
  if (!contract) {
    throw new NotFoundError("Contrat introuvable.");
  }
  const active = await invoiceService.getActiveInvoiceForContract(contract.Id);
  if (!active) {
    throw new BadRequestError("Aucun montant à payer n'est établi pour ce contrat.");
  }
  const invoice = await Invoice.findByPk(active.Id, {
    include: [{ model: InvoiceLine, as: "Lines", separate: true, order: [["SortOrder", "ASC"]] }]
  });
  return { contract, invoice };
};

/**
 * Tant que le paiement est un brouillon, l'aperçu montre l'échéance qui sera
 * appliquée à l'envoi ; une fois envoyé, il montre les dates figées.
 */
const documentDates = (invoice, requestedDueDate) => {
  if (requestedDueDate && !DATE_ONLY.test(requestedDueDate)) {
    throw new BadRequestError("dueDate doit être au format AAAA-MM-JJ.");
  }
  const isDraft = invoice.Status === INVOICE_STATUS.DRAFT;
  return {
    issueDate: invoice.IssuedAt || invoiceService.today(),
    dueDate: isDraft ? invoiceService.resolveDueDate(invoice, requestedDueDate) : invoice.DueDate
  };
};

/** Conditions figées si le contrat a été envoyé, sinon les valeurs actuelles des paramètres. */
const termsFor = async (invoice) => invoice.TermsSnapshot ?? (await getContractTerms()).values;

const documentFilename = (contract, invoice) => `Contrat-${contract.Reference}-${invoice.InvoiceNumber}.pdf`;

export const getContractDocument = async (id, { dueDate } = {}) => {
  const { contract, invoice } = await loadForDocument(id);
  const buffer = await buildContractPdf({ contract, invoice, ...documentDates(invoice, dueDate), terms: await termsFor(invoice) });
  return { buffer, filename: documentFilename(contract, invoice) };
};

/**
 * Envoie le contrat PDF au client par courriel, puis marque le paiement
 * « envoyé » (échéance figée). Un contrat déjà envoyé peut être renvoyé
 * sans changer ses dates. Indépendant de NOTIFICATIONS_DRY_RUN (réservé aux
 * notifications aux résidents) : envoi réel dès que SMTP est configuré. Sans
 * SMTP, ou avec CONTRACT_EMAIL_DRY_RUN=true, le courriel est seulement
 * journalisé (`dryRun: true` dans la réponse).
 */
export const sendContractToClient = async (id, { dueDate } = {}) => {
  const { contract, invoice } = await loadForDocument(id);
  const to = contract.Client?.Email?.trim();
  if (!to) {
    throw new BadRequestError("Ce client n'a pas d'adresse courriel. Ajoutez-la sur sa fiche, ou téléchargez le contrat et marquez-le envoyé.");
  }
  if (invoice.Status === INVOICE_STATUS.PAID) {
    throw new ConflictError("Ce contrat est déjà payé.");
  }

  const dates = documentDates(invoice, dueDate);
  const pdf = await buildContractPdf({ contract, invoice, ...dates, terms: await termsFor(invoice) });
  const email = buildContractEmail({ contract, invoice, dueDate: dates.dueDate });

  // Courriel d'abord : si l'envoi échoue, le contrat reste « à envoyer ».
  await getContractEmailProvider().send({
    to,
    ...email,
    attachments: [{ filename: documentFilename(contract, invoice), content: pdf, contentType: "application/pdf" }]
  });

  if (invoice.Status === INVOICE_STATUS.DRAFT) {
    await invoiceService.sendInvoice(invoice.Id, { dueDate: dates.dueDate, sentToEmail: to });
  } else {
    invoice.SentToEmail = to;
    await invoice.save();
  }
  logger.info(`Contrat envoyé par courriel | ${contract.Reference} → ${to}`);

  return {
    sentTo: to,
    dryRun: !isContractEmailLive(),
    invoice: await invoiceService.getInvoiceById(invoice.Id)
  };
};
