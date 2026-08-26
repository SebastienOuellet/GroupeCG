import db from "../../../models/index.js";
import { logger } from "../../config/logger.js";
import { CONSENT_ACTIONS, PERSON_TYPES } from "./consent.constants.js";
import { CHANNELS } from "../notification/notification.constants.js";

const { ConsentLog, SuppressedContact, Client, Tenant, Sequelize } = db;
const { Op } = Sequelize;

const normalizePhone = (phone) => {
  const digits = String(phone || "").replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits;
};

const normalizeEmail = (email) => String(email || "").trim().toLowerCase() || null;

export const normalizeAddress = (channel, address) =>
  channel === CHANNELS.SMS ? normalizePhone(address) : normalizeEmail(address);

/** Journal d'audit Loi 25 — append-only. */
export const logConsent = async ({ personType, personId, channel, address, action, method, actorUserId, ipAddress, metadata }) => {
  return ConsentLog.create({
    PersonType: personType || PERSON_TYPES.UNKNOWN,
    PersonId: personId || null,
    Channel: channel,
    Address: address,
    Action: action,
    Method: method,
    ActorUserId: actorUserId || null,
    IpAddress: ipAddress || null,
    Metadata: metadata || null
  });
};

export const getConsentLogs = async ({ address } = {}) => {
  const where = {};
  if (address) {
    where.Address = { [Op.iLike]: `%${address}%` };
  }
  return ConsentLog.findAll({ where, order: [["createdAt", "DESC"]], limit: 200 });
};

export const isSuppressed = async (channel, address) => {
  const normalized = normalizeAddress(channel, address);
  if (!normalized) return false;
  const found = await SuppressedContact.findOne({ where: { Channel: channel, Address: normalized } });
  return !!found;
};

export const getSuppressedContacts = async () => {
  return SuppressedContact.findAll({ order: [["createdAt", "DESC"]] });
};

/**
 * Ajoute un contact à la liste de suppression et révoque le consentement
 * de tous les Clients/Tenants portant cette adresse. Idempotent.
 */
export const suppressContact = async ({ channel, address, reason, method, actorUserId, ipAddress }) => {
  const normalized = normalizeAddress(channel, address);
  if (!normalized) {
    return { suppressed: false, reason: "adresse invalide" };
  }

  await SuppressedContact.findOrCreate({
    where: { Channel: channel, Address: normalized },
    defaults: { Reason: reason }
  });

  const consentField = channel === CHANNELS.SMS ? "SmsConsent" : "EmailConsent";
  const matchField = channel === CHANNELS.SMS ? "Phone" : "Email";

  // Variantes de format pour les téléphones stockés sans +1
  const variants = channel === CHANNELS.SMS
    ? [normalized, normalized.replace(/^\+1/, ""), normalized.replace(/^\+/, "")]
    : [normalized];

  const clients = await Client.findAll({ where: { [matchField]: { [Op.in]: variants } } });
  for (const client of clients) {
    if (client[consentField]) {
      client[consentField] = false;
      await client.save();
      await logConsent({
        personType: PERSON_TYPES.CLIENT,
        personId: client.Id,
        channel,
        address: normalized,
        action: CONSENT_ACTIONS.REVOKED,
        method,
        actorUserId,
        ipAddress
      });
    }
  }

  const tenants = await Tenant.findAll({ where: { [matchField]: { [Op.in]: variants } } });
  for (const tenant of tenants) {
    if (tenant[consentField]) {
      tenant[consentField] = false;
      await tenant.save();
      await logConsent({
        personType: PERSON_TYPES.TENANT,
        personId: tenant.Id,
        channel,
        address: normalized,
        action: CONSENT_ACTIONS.REVOKED,
        method,
        actorUserId,
        ipAddress
      });
    }
  }

  if (clients.length === 0 && tenants.length === 0) {
    await logConsent({
      personType: PERSON_TYPES.UNKNOWN,
      channel,
      address: normalized,
      action: CONSENT_ACTIONS.REVOKED,
      method,
      actorUserId,
      ipAddress
    });
  }

  logger.info(`Contact supprimé de la liste d'envoi | ${channel}:${normalized} (${reason})`);
  return { suppressed: true, address: normalized, clientsUpdated: clients.length, tenantsUpdated: tenants.length };
};

/**
 * Retire un contact de la liste de suppression (ré-abonnement documenté)
 * et redonne le consentement aux personnes correspondantes.
 */
export const unsuppressContact = async ({ channel, address, method, actorUserId, ipAddress }) => {
  const normalized = normalizeAddress(channel, address);
  if (!normalized) {
    return { unsuppressed: false };
  }

  await SuppressedContact.destroy({ where: { Channel: channel, Address: normalized } });

  const consentField = channel === CHANNELS.SMS ? "SmsConsent" : "EmailConsent";
  const matchField = channel === CHANNELS.SMS ? "Phone" : "Email";
  const variants = channel === CHANNELS.SMS
    ? [normalized, normalized.replace(/^\+1/, ""), normalized.replace(/^\+/, "")]
    : [normalized];

  const [clients, tenants] = await Promise.all([
    Client.findAll({ where: { [matchField]: { [Op.in]: variants } } }),
    Tenant.findAll({ where: { [matchField]: { [Op.in]: variants } } })
  ]);

  for (const person of [...clients, ...tenants]) {
    person[consentField] = true;
    await person.save();
  }

  await logConsent({
    personType: clients.length ? PERSON_TYPES.CLIENT : tenants.length ? PERSON_TYPES.TENANT : PERSON_TYPES.UNKNOWN,
    personId: clients[0]?.Id || tenants[0]?.Id || null,
    channel,
    address: normalized,
    action: CONSENT_ACTIONS.GRANTED,
    method,
    actorUserId,
    ipAddress
  });

  logger.info(`Contact retiré de la liste de suppression | ${channel}:${normalized}`);
  return { unsuppressed: true, address: normalized };
};
