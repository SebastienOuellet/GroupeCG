import db from "../../../models/index.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../errors/Errors.js";
import { CONTRACT_STATUS } from "./contract.constants.js";
import { logger } from "../../config/logger.js";

const { Contract, Client, ServiceAddress, Route, sequelize, Sequelize } = db;
const { Op } = Sequelize;

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

export const getContracts = async ({ seasonYear, status, routeId, clientId } = {}) => {
  const where = {};
  if (seasonYear) where.SeasonStartYear = Number(seasonYear);
  if (status) where.Status = status;
  if (routeId) where.RouteId = routeId;
  if (clientId) where.ClientId = clientId;

  return Contract.findAll({
    where,
    include: defaultInclude,
    order: [["Reference", "ASC"]]
  });
};

export const getContractById = async (id) => {
  const contract = await Contract.findByPk(id, { include: defaultInclude });
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

    const contract = await Contract.create(
      {
        ...contractInfo,
        Reference: reference,
        ContractNumber: contractNumber
      },
      { transaction }
    );

    logger.info(`Nouveau contrat créé | ${contract.Reference} (#${contract.ContractNumber}) - client #${client.ClientNumber}`);
    return contract;
  });
};

export const updateContract = async (id, contractInfo) => {
  const contract = await Contract.findByPk(id);
  if (!contract) {
    throw new NotFoundError("Contrat introuvable.");
  }

  // Référence, numéro et rattachements structurants sont immuables
  const { Id, Reference, ContractNumber, ClientId, SeasonStartYear, ...updatable } = contractInfo;
  Object.assign(contract, updatable);
  await contract.save();
  return contract;
};

export const cancelContract = async (id) => {
  const contract = await Contract.findByPk(id);
  if (!contract) {
    throw new NotFoundError("Contrat introuvable.");
  }
  contract.Status = CONTRACT_STATUS.CANCELLED;
  await contract.save();
  logger.info(`Contrat annulé | ${contract.Reference}`);
  return contract;
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
      include: [{ model: Client, as: "Client" }],
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
