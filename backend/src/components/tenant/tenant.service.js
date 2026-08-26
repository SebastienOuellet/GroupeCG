import db from "../../../models/index.js";
import { BadRequestError, NotFoundError } from "../../errors/Errors.js";
import * as consentService from "../consent/consent.service.js";
import { CONSENT_ACTIONS, CONSENT_METHODS, PERSON_TYPES } from "../consent/consent.constants.js";
import { CHANNELS } from "../notification/notification.constants.js";

const { Tenant, ServiceAddress } = db;

const CONSENT_FIELDS = [
  { field: "SmsConsent", channel: CHANNELS.SMS, addressField: "Phone" },
  { field: "EmailConsent", channel: CHANNELS.EMAIL, addressField: "Email" }
];

/** Journalise les changements de consentement (audit Loi 25). */
const logConsentChanges = async (tenant, previous, { method = CONSENT_METHODS.ADMIN, actorUserId = null } = {}) => {
  for (const { field, channel, addressField } of CONSENT_FIELDS) {
    const address = tenant[addressField];
    if (!address) continue;
    const before = previous ? previous[field] : null;
    const after = tenant[field];
    if (before === after) continue;

    await consentService.logConsent({
      personType: PERSON_TYPES.TENANT,
      personId: tenant.Id,
      channel,
      address: consentService.normalizeAddress(channel, address),
      action: after ? CONSENT_ACTIONS.GRANTED : CONSENT_ACTIONS.REVOKED,
      method,
      actorUserId
    });
  }
};

export const getTenants = async ({ serviceAddressId, includeInactive = false } = {}) => {
  const where = {};
  if (!includeInactive) {
    where.IsActive = true;
  }
  if (serviceAddressId) {
    where.ServiceAddressId = serviceAddressId;
  }
  return Tenant.findAll({ where, order: [["Id", "ASC"]] });
};

export const getTenantById = async (id) => {
  const tenant = await Tenant.findByPk(id);
  if (!tenant) {
    throw new NotFoundError("Locataire introuvable.");
  }
  return tenant;
};

export const createTenant = async (tenantInfo, { method, actorUserId } = {}) => {
  if (!tenantInfo.ServiceAddressId) {
    throw new BadRequestError("ServiceAddressId est requis.");
  }
  const address = await ServiceAddress.findByPk(tenantInfo.ServiceAddressId);
  if (!address) {
    throw new NotFoundError("Adresse de service introuvable.");
  }
  if (!tenantInfo.Phone && !tenantInfo.Email) {
    throw new BadRequestError("Un téléphone ou un courriel est requis pour joindre le locataire.");
  }
  const tenant = await Tenant.create(tenantInfo);
  await logConsentChanges(tenant, null, { method, actorUserId });
  return tenant;
};

export const updateTenant = async (id, tenantInfo, { method, actorUserId } = {}) => {
  const tenant = await getTenantById(id);
  const previous = { SmsConsent: tenant.SmsConsent, EmailConsent: tenant.EmailConsent };
  const { Id, ServiceAddressId, ...updatable } = tenantInfo;
  Object.assign(tenant, updatable);
  await tenant.save();
  await logConsentChanges(tenant, previous, { method, actorUserId });
  return tenant;
};

export const deactivateTenant = async (id) => {
  const tenant = await getTenantById(id);
  tenant.IsActive = false;
  await tenant.save();
  return tenant;
};
