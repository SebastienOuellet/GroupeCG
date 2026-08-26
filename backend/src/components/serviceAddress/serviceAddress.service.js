import db from "../../../models/index.js";
import { NotFoundError } from "../../errors/Errors.js";

const { ServiceAddress, Tenant, Contract } = db;

export const getServiceAddresses = async ({ clientId, includeInactive = false } = {}) => {
  const where = {};
  if (!includeInactive) {
    where.IsActive = true;
  }
  if (clientId) {
    where.ClientId = clientId;
  }
  return ServiceAddress.findAll({ where, order: [["Id", "ASC"]] });
};

export const getServiceAddressById = async (id) => {
  const address = await ServiceAddress.findByPk(id, {
    include: [
      { model: Tenant, as: "Tenants" },
      { model: Contract, as: "Contracts" }
    ]
  });
  if (!address) {
    throw new NotFoundError("Adresse de service introuvable.");
  }
  return address;
};

export const createServiceAddress = async (addressInfo) => {
  return ServiceAddress.create(addressInfo);
};

export const updateServiceAddress = async (id, addressInfo) => {
  const address = await ServiceAddress.findByPk(id);
  if (!address) {
    throw new NotFoundError("Adresse de service introuvable.");
  }
  const { Id, ClientId, ...updatable } = addressInfo;
  Object.assign(address, updatable);
  await address.save();
  return address;
};

export const deactivateServiceAddress = async (id) => {
  const address = await ServiceAddress.findByPk(id);
  if (!address) {
    throw new NotFoundError("Adresse de service introuvable.");
  }
  address.IsActive = false;
  await address.save();
  return address;
};
