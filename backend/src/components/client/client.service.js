import db from "../../../models/index.js";
import { NotFoundError } from "../../errors/Errors.js";
import { logger } from "../../config/logger.js";
import * as consentService from "../consent/consent.service.js";
import { validateContactFields } from "../consent/contact.validation.js";
import { CONSENT_METHODS, PERSON_TYPES } from "../consent/consent.constants.js";

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
      { model: ServiceAddress, as: "ServiceAddresses", where: { IsActive: true }, required: false },
      { model: Contract, as: "Contracts", order: [["SeasonStartYear", "DESC"]] }
    ]
  });
  if (!client) {
    throw new NotFoundError("Client introuvable.");
  }
  // `Suppressions` : désinscriptions SMS/courriel du client (verrouillage à l'écran)
  const [withSuppressions] = await consentService.withSuppressions([client]);
  return withSuppressions;
};

/**
 * Crée un client. Si `ServiceAddress` est fourni dans le payload, la première adresse de
 * service est créée dans la même transaction : la création rapide depuis le formulaire de
 * contrat ne laisse jamais de client orphelin si l'adresse est invalide.
 */
export const createClient = async (payload) => {
  const { ServiceAddress: addressInfo, ...clientInfo } = payload;
  validateContactFields(clientInfo);

  return sequelize.transaction(async (transaction) => {
    const maxNumber = await Client.max("ClientNumber", { transaction });
    const clientNumber = Math.max(maxNumber || 0, CLIENT_NUMBER_SEED) + 1;

    const { Id, Suppressions, ...fields } = clientInfo;
    await consentService.applySuppressionsToConsents(fields);
    const client = await Client.create(
      { ...fields, ClientNumber: clientNumber },
      { transaction }
    );

    if (addressInfo) {
      const { Id, ClientId, ...addressFields } = addressInfo;
      const address = await ServiceAddress.create(
        { ...addressFields, ClientId: client.Id },
        { transaction }
      );
      client.setDataValue("ServiceAddresses", [address]);
    }

    logger.info(`Nouveau client créé | #${client.ClientNumber} - ${client.FirstName || ""} ${client.LastName || ""}`);
    return client;
  });
};

/**
 * Un canal dont le client s'est désinscrit reste verrouillé (numéro/courriel et
 * consentement) ; chaque changement de consentement est journalisé (Loi 25).
 */
export const updateClient = async (id, clientInfo, { actorUserId } = {}) => {
  const client = await Client.findByPk(id);
  if (!client) {
    throw new NotFoundError("Client introuvable.");
  }

  // Le numéro de client est immuable
  const { ClientNumber, Id, Suppressions, ServiceAddresses, Contracts, ...updatable } = clientInfo;
  validateContactFields(updatable);
  await consentService.assertSuppressionRespected(client, updatable);
  const previous = { SmsConsent: client.SmsConsent, EmailConsent: client.EmailConsent };
  Object.assign(client, updatable);
  await consentService.applySuppressionsToConsents(client);
  await client.save();
  await consentService.logPersonConsentChanges(PERSON_TYPES.CLIENT, client, previous, { method: CONSENT_METHODS.ADMIN, actorUserId });
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
