import db from "../../../models/index.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../errors/Errors.js";
import { CONTRACT_STATUS } from "../contract/contract.constants.js";
import { LOCATION_SOURCE, LOCATION_SOURCES } from "./serviceAddress.constants.js";

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

/** Comparaison à la précision stockée (DECIMAL 9,6). */
const sameCoordinate = (a, b) => a != null && b != null && Number(a).toFixed(6) === Number(b).toFixed(6);

/**
 * Provenance et date des coordonnées, gérées ici (jamais prises telles quelles du client) :
 *  - coordonnées retirées → provenance et date effacées ;
 *  - coordonnées changées, ou `LocationSource` explicite (rafraîchissement Google, pin corrigé)
 *    → provenance (Google par défaut) + LocationUpdatedAt = maintenant ;
 *  - coordonnées renvoyées inchangées (ex. modification des notes) → rien ne bouge :
 *    un pin corrigé à la main reste un pin manuel.
 */
export const applyLocationMetadata = (target, input, current = {}) => {
  const { LocationSource: requestedSource, LocationUpdatedAt, ...fields } = input;
  if (requestedSource != null && !LOCATION_SOURCES.includes(requestedSource)) {
    throw new BadRequestError(`Provenance des coordonnées invalide : ${requestedSource}.`);
  }
  Object.assign(target, fields);

  const touchesLocation = "Latitude" in fields || "Longitude" in fields;
  if (!touchesLocation) return target;

  const latitude = "Latitude" in fields ? fields.Latitude : current.Latitude;
  const longitude = "Longitude" in fields ? fields.Longitude : current.Longitude;
  if (latitude == null || latitude === "" || longitude == null || longitude === "") {
    target.Latitude = null;
    target.Longitude = null;
    target.LocationSource = null;
    target.LocationUpdatedAt = null;
    return target;
  }

  const changed = !sameCoordinate(latitude, current.Latitude) || !sameCoordinate(longitude, current.Longitude);
  if (changed || requestedSource) {
    target.LocationSource = requestedSource ?? LOCATION_SOURCE.GOOGLE_PLACES;
    target.LocationUpdatedAt = new Date();
  }
  return target;
};

export const createServiceAddress = async (addressInfo) => {
  const { Id, ...fields } = addressInfo;
  return ServiceAddress.create(applyLocationMetadata({}, fields));
};

export const updateServiceAddress = async (id, addressInfo) => {
  const address = await ServiceAddress.findByPk(id);
  if (!address) {
    throw new NotFoundError("Adresse de service introuvable.");
  }
  const { Id, ClientId, ...updatable } = addressInfo;
  applyLocationMetadata(address, updatable, { Latitude: address.Latitude, Longitude: address.Longitude });
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
