import db from "../../../models/index.js";
import { BadRequestError, NotFoundError } from "../../errors/Errors.js";
import * as consentService from "../consent/consent.service.js";
import { validateContactFields } from "../consent/contact.validation.js";
import { CONSENT_METHODS, PERSON_TYPES } from "../consent/consent.constants.js";

const { Tenant, ServiceAddress } = db;

/** Liste avec `Suppressions` (désinscriptions par canal) pour l'affichage. */
export const getTenants = async ({ serviceAddressId, includeInactive = false } = {}) => {
  const where = {};
  if (!includeInactive) {
    where.IsActive = true;
  }
  if (serviceAddressId) {
    where.ServiceAddressId = serviceAddressId;
  }
  const tenants = await Tenant.findAll({ where, order: [["Id", "ASC"]] });
  return consentService.withSuppressions(tenants);
};

export const getTenantById = async (id) => {
  const tenant = await Tenant.findByPk(id);
  if (!tenant) {
    throw new NotFoundError("Locataire introuvable.");
  }
  return tenant;
};

export const createTenant = async (tenantInfo, { method = CONSENT_METHODS.ADMIN, actorUserId, ipAddress } = {}) => {
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
  validateContactFields(tenantInfo);
  const { Id, IsActive, Suppressions, ...fields } = tenantInfo;
  await consentService.applySuppressionsToConsents(fields);
  const tenant = await Tenant.create(fields);
  await consentService.logPersonConsentChanges(PERSON_TYPES.TENANT, tenant, null, { method, actorUserId, ipAddress });
  return tenant;
};

export const updateTenant = async (id, tenantInfo, { method = CONSENT_METHODS.ADMIN, actorUserId, ipAddress } = {}) => {
  const tenant = await getTenantById(id);
  const previous = { SmsConsent: tenant.SmsConsent, EmailConsent: tenant.EmailConsent };
  const { Id, ServiceAddressId, IsActive, Suppressions, ...updatable } = tenantInfo;
  validateContactFields(updatable);
  await consentService.assertSuppressionRespected(tenant, updatable);

  const phone = updatable.Phone !== undefined ? updatable.Phone : tenant.Phone;
  const email = updatable.Email !== undefined ? updatable.Email : tenant.Email;
  if (!phone && !email) {
    throw new BadRequestError("Un téléphone ou un courriel est requis pour joindre le locataire.");
  }
  Object.assign(tenant, updatable);
  // Nouveau numéro/courriel déjà désinscrit : consentement de ce canal forcé à faux
  await consentService.applySuppressionsToConsents(tenant);
  await tenant.save();
  await consentService.logPersonConsentChanges(PERSON_TYPES.TENANT, tenant, previous, { method, actorUserId, ipAddress });
  return tenant;
};

export const deactivateTenant = async (id) => {
  const tenant = await getTenantById(id);
  tenant.IsActive = false;
  await tenant.save();
  return tenant;
};
