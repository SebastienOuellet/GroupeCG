import db from "../../../models/index.js";
import { ConflictError, NotFoundError } from "../../errors/Errors.js";
import { CONTRACT_STATUS } from "../contract/contract.constants.js";

const { ServiceAddress, Tenant, Contract, Sequelize } = db;

/** Statuts qui font encore travailler l'adresse (notifications, route de l'opérateur). */
const BLOCKING_CONTRACT_STATUSES = [CONTRACT_STATUS.DRAFT, CONTRACT_STATUS.ACTIVE];

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

  const blockingContracts = await Contract.count({
    where: { ServiceAddressId: id, Status: { [Sequelize.Op.in]: BLOCKING_CONTRACT_STATUSES } }
  });
  if (blockingContracts > 0) {
    throw new ConflictError(
      `Impossible de désactiver cette adresse : ${blockingContracts} contrat(s) actif(s) ou brouillon(s) y sont liés. Terminez-les ou annulez-les d'abord.`
    );
  }

  address.IsActive = false;
  await address.save();
  return address;
};
