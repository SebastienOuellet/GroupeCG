import db from "../../../models/index.js";
import { BadRequestError, ForbiddenError, UnauthorizedError } from "../../errors/Errors.js";
import { signPortalToken } from "./portal.token.js";
import * as tenantService from "../tenant/tenant.service.js";
import * as consentService from "../consent/consent.service.js";
import { CONSENT_METHODS, PERSON_TYPES } from "../consent/consent.constants.js";

const { Contract, Client, ServiceAddress, Tenant } = db;

const GENERIC_LOGIN_ERROR = "Référence ou numéro de contrat invalide.";

/**
 * Authentification du portail: référence client (YY-XXXX) + numéro de
 * contrat. Message d'erreur volontairement générique (ne précise jamais
 * quel champ est en cause) pour ne pas faciliter l'énumération.
 */
export const login = async ({ reference, contractNumber }) => {
  if (!reference || !contractNumber) {
    throw new BadRequestError("La référence et le numéro de contrat sont requis.");
  }

  const contract = await Contract.findOne({
    where: {
      Reference: String(reference).trim(),
      ContractNumber: Number(contractNumber)
    }
  });

  if (!contract) {
    throw new UnauthorizedError(GENERIC_LOGIN_ERROR);
  }

  return { token: signPortalToken(contract.Id) };
};

/** Charge le contrat scopé à la session (le seul que le token autorise). */
const getOwnContract = async (contractId) => {
  const contract = await Contract.findByPk(contractId, {
    include: [
      { model: Client, as: "Client" },
      { model: ServiceAddress, as: "ServiceAddress", include: [{ model: Tenant, as: "Tenants" }] }
    ]
  });
  if (!contract) {
    throw new UnauthorizedError("Session expirée. Veuillez vous reconnecter.");
  }
  return contract;
};

export const getMe = async (contractId) => {
  const contract = await getOwnContract(contractId);
  const client = contract.Client;
  const address = contract.ServiceAddress;

  return {
    contract: {
      Reference: contract.Reference,
      ContractNumber: contract.ContractNumber,
      SeasonStartYear: contract.SeasonStartYear,
      Status: contract.Status,
      StartDate: contract.StartDate,
      EndDate: contract.EndDate
    },
    client: {
      FirstName: client.FirstName,
      LastName: client.LastName,
      CompanyName: client.CompanyName,
      Email: client.Email,
      Phone: client.Phone,
      SmsConsent: client.SmsConsent,
      EmailConsent: client.EmailConsent
    },
    serviceAddress: {
      CivicNumber: address.CivicNumber,
      Street: address.Street,
      City: address.City,
      PostalCode: address.PostalCode
    },
    tenants: (address.Tenants || []).filter((t) => t.IsActive)
  };
};

export const createTenant = async (contractId, tenantInfo, ipAddress) => {
  const contract = await getOwnContract(contractId);
  return tenantService.createTenant(
    { ...tenantInfo, ServiceAddressId: contract.ServiceAddressId },
    { method: CONSENT_METHODS.SELF_SERVICE, ipAddress }
  );
};

/** Vérifie que le locataire vit bien à l'adresse du contrat de la session. */
const assertOwnsTenant = async (contractId, tenantId) => {
  const contract = await getOwnContract(contractId);
  const tenant = await tenantService.getTenantById(tenantId);
  if (tenant.ServiceAddressId !== contract.ServiceAddressId) {
    throw new ForbiddenError("Ce locataire n'appartient pas à votre contrat.");
  }
  return tenant;
};

export const updateTenant = async (contractId, tenantId, tenantInfo, ipAddress) => {
  await assertOwnsTenant(contractId, tenantId);
  return tenantService.updateTenant(tenantId, tenantInfo, { method: CONSENT_METHODS.SELF_SERVICE, ipAddress });
};

export const deactivateTenant = async (contractId, tenantId) => {
  await assertOwnsTenant(contractId, tenantId);
  return tenantService.deactivateTenant(tenantId);
};

export const updatePreferences = async (contractId, { SmsConsent, EmailConsent }, ipAddress) => {
  const contract = await getOwnContract(contractId);
  const client = contract.Client;
  const previous = { SmsConsent: client.SmsConsent, EmailConsent: client.EmailConsent };

  if (SmsConsent !== undefined) client.SmsConsent = !!SmsConsent;
  if (EmailConsent !== undefined) client.EmailConsent = !!EmailConsent;
  await client.save();

  await consentService.logPersonConsentChanges(PERSON_TYPES.CLIENT, client, previous, {
    method: CONSENT_METHODS.SELF_SERVICE,
    ipAddress
  });

  return { SmsConsent: client.SmsConsent, EmailConsent: client.EmailConsent };
};
