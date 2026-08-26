import db from "../../models/index.js";
import { BadRequestError } from "../errors/Errors.js";
import { CONTRACT_STATUS } from "../components/contract/contract.constants.js";
import { CHANNELS, RECIPIENT_TYPES, TARGET_TYPES } from "../components/notification/notification.constants.js";

const { Contract, Client, ServiceAddress, Tenant, SuppressedContact } = db;

/**
 * Requête centrale de résolution des destinataires pour une cible
 * (route / contrat / tous). Règles de conformité appliquées ici, une seule
 * fois pour tout le système:
 *   - contrat ACTIF seulement,
 *   - consentement du canal requis,
 *   - contact absent de la liste de suppression,
 *   - personnes et entités actives (IsActive).
 *
 * Retourne une liste de { channel, recipientType, recipientId, contactAddress,
 * contractId, variables, consented, suppressed } — les non-conformes sont
 * retournés marqués (et non filtrés) pour être journalisés en Deliveries.
 */
export const resolveRecipients = async ({ targetType, targetId, useSms, useEmail }) => {
  const contractWhere = { Status: CONTRACT_STATUS.ACTIVE };

  if (targetType === TARGET_TYPES.ROUTE) {
    if (!targetId) throw new BadRequestError("targetId est requis pour une cible route.");
    contractWhere.RouteId = targetId;
  } else if (targetType === TARGET_TYPES.CONTRACT) {
    if (!targetId) throw new BadRequestError("targetId est requis pour une cible contrat.");
    contractWhere.Id = targetId;
  } else if (targetType !== TARGET_TYPES.ALL) {
    throw new BadRequestError(`TargetType inconnu: ${targetType}`);
  }

  const contracts = await Contract.findAll({
    where: contractWhere,
    include: [
      { model: Client, as: "Client" },
      { model: ServiceAddress, as: "ServiceAddress", include: [{ model: Tenant, as: "Tenants" }] }
    ]
  });

  const suppressed = await SuppressedContact.findAll({ raw: true });
  const suppressedSet = new Set(suppressed.map((s) => `${s.Channel}:${s.Address.toLowerCase()}`));
  const isSuppressed = (channel, address) => suppressedSet.has(`${channel}:${String(address).toLowerCase()}`);

  const recipients = [];
  const seen = new Set();

  const push = ({ channel, recipientType, recipientId, contactAddress, contractId, consented, person }) => {
    if (!contactAddress) return;
    const dedupeKey = `${channel}:${String(contactAddress).toLowerCase()}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    recipients.push({
      channel,
      recipientType,
      recipientId,
      contactAddress,
      contractId,
      consented,
      suppressed: isSuppressed(channel, contactAddress),
      variables: person
    });
  };

  for (const contract of contracts) {
    const client = contract.Client;
    const address = contract.ServiceAddress;
    const addressLabel = address ? `${address.CivicNumber} ${address.Street}, ${address.City}` : "";

    if (client?.IsActive) {
      const clientVariables = {
        firstName: client.FirstName || client.CompanyName || "",
        address: addressLabel,
        reference: contract.Reference
      };
      if (useSms && client.Phone) {
        push({
          channel: CHANNELS.SMS,
          recipientType: RECIPIENT_TYPES.CLIENT,
          recipientId: client.Id,
          contactAddress: client.Phone,
          contractId: contract.Id,
          consented: client.SmsConsent,
          person: clientVariables
        });
      }
      if (useEmail && client.Email) {
        push({
          channel: CHANNELS.EMAIL,
          recipientType: RECIPIENT_TYPES.CLIENT,
          recipientId: client.Id,
          contactAddress: client.Email,
          contractId: contract.Id,
          consented: client.EmailConsent,
          person: clientVariables
        });
      }
    }

    for (const tenant of address?.Tenants || []) {
      if (!tenant.IsActive) continue;
      const tenantVariables = {
        firstName: tenant.FirstName || "",
        address: addressLabel,
        reference: contract.Reference
      };
      if (useSms && tenant.Phone) {
        push({
          channel: CHANNELS.SMS,
          recipientType: RECIPIENT_TYPES.TENANT,
          recipientId: tenant.Id,
          contactAddress: tenant.Phone,
          contractId: contract.Id,
          consented: tenant.SmsConsent,
          person: tenantVariables
        });
      }
      if (useEmail && tenant.Email) {
        push({
          channel: CHANNELS.EMAIL,
          recipientType: RECIPIENT_TYPES.TENANT,
          recipientId: tenant.Id,
          contactAddress: tenant.Email,
          contractId: contract.Id,
          consented: tenant.EmailConsent,
          person: tenantVariables
        });
      }
    }
  }

  return recipients;
};
