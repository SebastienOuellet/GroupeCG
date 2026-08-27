import db from "../../../models/index.js";
import { BadRequestError, NotFoundError } from "../../errors/Errors.js";
import * as consentService from "../consent/consent.service.js";
import { PERSON_TYPES } from "../consent/consent.constants.js";

const { Tenant, ServiceAddress } = db;

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

export const createTenant = async (tenantInfo, { method, actorUserId, ipAddress } = {}) => {
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
  await consentService.logPersonConsentChanges(PERSON_TYPES.TENANT, tenant, null, { method, actorUserId, ipAddress });
  return tenant;
};

export const updateTenant = async (id, tenantInfo, { method, actorUserId, ipAddress } = {}) => {
  const tenant = await getTenantById(id);
  const previous = { SmsConsent: tenant.SmsConsent, EmailConsent: tenant.EmailConsent };
  const { Id, ServiceAddressId, ...updatable } = tenantInfo;
  Object.assign(tenant, updatable);
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
