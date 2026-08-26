import db from "../../../models/index.js";
import { BadRequestError, NotFoundError } from "../../errors/Errors.js";
import { resolveRecipients } from "../../notifications/recipientResolver.js";
import { logger } from "../../config/logger.js";
import {
  BATCH_STATUS,
  BATCH_TYPES,
  DELIVERY_STATUS
} from "./notification.constants.js";

const { NotificationBatch, NotificationDelivery, NotificationTemplate, User, sequelize } = db;

/**
 * Crée un batch + ses livraisons (la mise en file). Transactionnel.
 * Les destinataires sans consentement ou supprimés sont insérés avec un
 * statut terminal pour une traçabilité complète.
 */
export const enqueueBatch = async ({
  type = BATCH_TYPES.MANUAL,
  targetType,
  targetId = null,
  templateId = null,
  smsBody,
  emailSubject,
  emailBody,
  useSms = false,
  useEmail = false,
  createdByUserId = null
}) => {
  if (!useSms && !useEmail) {
    throw new BadRequestError("Au moins un canal (SMS ou courriel) doit être activé.");
  }

  if (templateId) {
    const template = await NotificationTemplate.findByPk(templateId);
    if (!template) {
      throw new NotFoundError("Modèle de notification introuvable.");
    }
    smsBody = smsBody || template.SmsBody;
    emailSubject = emailSubject || template.EmailSubject;
    emailBody = emailBody || template.EmailBody;
  }

  if (useSms && !smsBody) {
    throw new BadRequestError("Un corps SMS est requis quand le canal SMS est activé.");
  }
  if (useEmail && (!emailSubject || !emailBody)) {
    throw new BadRequestError("Sujet et corps courriel sont requis quand le canal courriel est activé.");
  }

  const recipients = await resolveRecipients({ targetType, targetId, useSms, useEmail });

  return sequelize.transaction(async (transaction) => {
    const batch = await NotificationBatch.create(
      {
        Type: type,
        TargetType: targetType,
        TargetId: targetId,
        TemplateId: templateId,
        SmsBody: smsBody || null,
        EmailSubject: emailSubject || null,
        EmailBody: emailBody || null,
        UseSms: useSms,
        UseEmail: useEmail,
        Status: BATCH_STATUS.PROCESSING,
        CreatedByUserId: createdByUserId,
        TotalCount: recipients.length
      },
      { transaction }
    );

    const rows = recipients.map((recipient) => ({
      BatchId: batch.Id,
      Channel: recipient.channel,
      RecipientType: recipient.recipientType,
      RecipientId: recipient.recipientId,
      ContactAddress: recipient.contactAddress,
      ContractId: recipient.contractId,
      Status: recipient.suppressed
        ? DELIVERY_STATUS.SUPPRESSED
        : recipient.consented
          ? DELIVERY_STATUS.QUEUED
          : DELIVERY_STATUS.SKIPPED_NO_CONSENT
    }));

    await NotificationDelivery.bulkCreate(rows, { transaction });

    const queuedCount = rows.filter((r) => r.Status === DELIVERY_STATUS.QUEUED).length;
    logger.info(
      `Batch ${batch.Id} mis en file | cible ${targetType}${targetId ? "#" + targetId : ""} | ${queuedCount}/${rows.length} en file`
    );

    return batch;
  });
};

export const getBatches = async () => {
  return NotificationBatch.findAll({
    include: [
      { model: User, as: "CreatedBy", attributes: ["Id", "Name", "Email"] },
      { model: NotificationTemplate, as: "Template", attributes: ["Id", "Name"] }
    ],
    order: [["createdAt", "DESC"]],
    limit: 100
  });
};

export const getBatchById = async (id) => {
  const batch = await NotificationBatch.findByPk(id, {
    include: [
      { model: User, as: "CreatedBy", attributes: ["Id", "Name", "Email"] },
      { model: NotificationTemplate, as: "Template", attributes: ["Id", "Name"] }
    ]
  });
  if (!batch) {
    throw new NotFoundError("Batch introuvable.");
  }
  return batch;
};

export const getBatchDeliveries = async (batchId) => {
  await getBatchById(batchId);
  return NotificationDelivery.findAll({
    where: { BatchId: batchId },
    order: [["Id", "ASC"]]
  });
};

/** Met à jour une livraison selon un callback de statut du fournisseur. */
export const applyProviderStatus = async ({ providerMessageId, providerStatus }) => {
  if (!providerMessageId) return false;
  const delivery = await NotificationDelivery.findOne({ where: { ProviderMessageId: providerMessageId } });
  if (!delivery) return false;

  if (["undelivered", "failed"].includes(providerStatus) && delivery.Status === DELIVERY_STATUS.SENT) {
    delivery.Status = DELIVERY_STATUS.FAILED;
    delivery.LastError = `Statut fournisseur: ${providerStatus}`;
    await delivery.save();
  }
  return true;
};
