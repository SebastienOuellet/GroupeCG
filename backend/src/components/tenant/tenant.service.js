import db from "../../../models/index.js";
import { BadRequestError, NotFoundError } from "../../errors/Errors.js";

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

export const createTenant = async (tenantInfo) => {
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
  return Tenant.create(tenantInfo);
};

export const updateTenant = async (id, tenantInfo) => {
  const tenant = await getTenantById(id);
  const { Id, ServiceAddressId, ...updatable } = tenantInfo;
  Object.assign(tenant, updatable);
  await tenant.save();
  return tenant;
};

export const deactivateTenant = async (id) => {
  const tenant = await getTenantById(id);
  tenant.IsActive = false;
  await tenant.save();
  return tenant;
};
