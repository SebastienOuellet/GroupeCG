import db from "../../../models/index.js";
import { NotFoundError } from "../../errors/Errors.js";
import { logger } from "../../config/logger.js";

const { Client, ServiceAddress, Contract, sequelize } = db;

const CLIENT_NUMBER_SEED = 1000;

export const getClients = async ({ search, includeInactive = false } = {}) => {
  const where = {};
  if (!includeInactive) {
    where.IsActive = true;
  }
  if (search) {
    const term = `%${search}%`;
    where[db.Sequelize.Op.or] = [
      { FirstName: { [db.Sequelize.Op.iLike]: term } },
      { LastName: { [db.Sequelize.Op.iLike]: term } },
      { CompanyName: { [db.Sequelize.Op.iLike]: term } },
      ...(Number.isInteger(Number(search)) ? [{ ClientNumber: Number(search) }] : [])
    ];
  }
  return Client.findAll({ where, order: [["ClientNumber", "ASC"]] });
};

export const getClientById = async (id) => {
  const client = await Client.findByPk(id, {
    include: [
      { model: ServiceAddress, as: "ServiceAddresses" },
      { model: Contract, as: "Contracts", order: [["SeasonStartYear", "DESC"]] }
    ]
  });
  if (!client) {
    throw new NotFoundError("Client introuvable.");
  }
  return client;
};

export const createClient = async (clientInfo) => {
  return sequelize.transaction(async (transaction) => {
    const maxNumber = await Client.max("ClientNumber", { transaction });
    const clientNumber = Math.max(maxNumber || 0, CLIENT_NUMBER_SEED) + 1;

    const client = await Client.create(
      { ...clientInfo, ClientNumber: clientNumber },
      { transaction }
    );

    logger.info(`Nouveau client créé | #${client.ClientNumber} - ${client.FirstName || ""} ${client.LastName || ""}`);
    return client;
  });
};

export const updateClient = async (id, clientInfo) => {
  const client = await Client.findByPk(id);
  if (!client) {
    throw new NotFoundError("Client introuvable.");
  }

  // Le numéro de client est immuable
  const { ClientNumber, Id, ...updatable } = clientInfo;
  Object.assign(client, updatable);
  await client.save();
  return client;
};

export const deactivateClient = async (id) => {
  const client = await Client.findByPk(id);
  if (!client) {
    throw new NotFoundError("Client introuvable.");
  }
  client.IsActive = false;
  await client.save();
  logger.info(`Client désactivé | #${client.ClientNumber}`);
  return client;
};
