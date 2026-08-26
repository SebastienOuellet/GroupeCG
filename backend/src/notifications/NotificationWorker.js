import db from "../../models/index.js";
import { logger } from "../config/logger.js";
import { getSmsProvider, getEmailProvider } from "./providerFactory.js";
import { buildSmsBody, buildEmailHtml, buildEmailText, interpolate } from "./MessageBuilder.js";
import {
  BATCH_STATUS,
  CHANNELS,
  DELIVERY_STATUS,
  MAX_DELIVERY_ATTEMPTS,
  RECIPIENT_TYPES
} from "../components/notification/notification.constants.js";

const { NotificationDelivery, NotificationBatch, Contract, Client, ServiceAddress, Tenant, sequelize, Sequelize } = db;
const { Op } = Sequelize;

const POLL_INTERVAL_MS = 10_000;
const BATCH_SIZE = 20;
const STUCK_SENDING_MINUTES = 5;

/**
 * Worker de la file de notifications. La file EST la table
 * NotificationDeliveries — résiliente aux redémarrages par conception.
 */
export class NotificationWorker {
  constructor() {
    this.timer = null;
    this.running = false;
  }

  start() {
    if (this.timer) return;
    this.recoverStuck().catch((error) => logger.error(`Worker recover: ${error.message}`));
    this.timer = setInterval(() => {
      this.tick().catch((error) => logger.error(`Worker tick: ${error.message}`));
    }, POLL_INTERVAL_MS);
    logger.info("NotificationWorker démarré.");
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Toute ligne `sending` depuis > 5 min est remise en file (crash/restart). */
  async recoverStuck() {
    const cutoff = new Date(Date.now() - STUCK_SENDING_MINUTES * 60_000);
    const [count] = await NotificationDelivery.update(
      { Status: DELIVERY_STATUS.QUEUED },
      { where: { Status: DELIVERY_STATUS.SENDING, updatedAt: { [Op.lt]: cutoff } } }
    );
    if (count > 0) {
      logger.warn(`NotificationWorker: ${count} livraison(s) bloquée(s) remise(s) en file.`);
    }
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const claimed = await this.claimBatch();
      for (const delivery of claimed) {
        await this.processDelivery(delivery);
      }
      if (claimed.length > 0) {
        await this.closeFinishedBatches(claimed.map((d) => d.BatchId));
      }
    } finally {
      this.running = false;
    }
  }

  /** Réclame un lot en `sending` de façon atomique (SKIP LOCKED). */
  async claimBatch() {
    return sequelize.transaction(async (transaction) => {
      const deliveries = await NotificationDelivery.findAll({
        where: {
          Status: DELIVERY_STATUS.QUEUED,
          NextAttemptAt: { [Op.lte]: new Date() }
        },
        order: [["Id", "ASC"]],
        limit: BATCH_SIZE,
        lock: transaction.LOCK.UPDATE,
        skipLocked: true,
        transaction
      });

      for (const delivery of deliveries) {
        delivery.Status = DELIVERY_STATUS.SENDING;
        await delivery.save({ transaction });
      }
      return deliveries;
    });
  }

  async processDelivery(delivery) {
    try {
      const batch = await NotificationBatch.findByPk(delivery.BatchId);
      const variables = await this.resolveVariables(delivery);

      let result;
      if (delivery.Channel === CHANNELS.SMS) {
        result = await getSmsProvider().send({
          to: delivery.ContactAddress,
          body: buildSmsBody(batch.SmsBody, variables)
        });
      } else if (delivery.Channel === CHANNELS.EMAIL) {
        result = await getEmailProvider().send({
          to: delivery.ContactAddress,
          subject: interpolate(batch.EmailSubject, variables),
          html: buildEmailHtml(batch.EmailBody, delivery.ContactAddress, variables),
          text: buildEmailText(batch.EmailBody, delivery.ContactAddress, variables)
        });
      } else {
        throw new Error(`Canal non supporté: ${delivery.Channel}`);
      }

      delivery.Status = DELIVERY_STATUS.SENT;
      delivery.SentAt = new Date();
      delivery.ProviderMessageId = result?.providerMessageId || null;
      await delivery.save();
    } catch (error) {
      delivery.Attempts += 1;
      delivery.LastError = error.message;
      if (delivery.Attempts < MAX_DELIVERY_ATTEMPTS) {
        delivery.Status = DELIVERY_STATUS.QUEUED;
        delivery.NextAttemptAt = new Date(Date.now() + Math.pow(2, delivery.Attempts) * 60_000);
      } else {
        delivery.Status = DELIVERY_STATUS.FAILED;
        logger.error(`Livraison ${delivery.Id} en échec définitif: ${error.message}`);
      }
      await delivery.save();
    }
  }

  /** Variables d'interpolation reconstituées au moment de l'envoi. */
  async resolveVariables(delivery) {
    const variables = { firstName: "", address: "", reference: "" };

    if (delivery.ContractId) {
      const contract = await Contract.findByPk(delivery.ContractId, {
        include: [{ model: ServiceAddress, as: "ServiceAddress" }]
      });
      if (contract) {
        variables.reference = contract.Reference;
        const address = contract.ServiceAddress;
        if (address) {
          variables.address = `${address.CivicNumber} ${address.Street}, ${address.City}`;
        }
      }
    }

    if (delivery.RecipientType === RECIPIENT_TYPES.CLIENT && delivery.RecipientId) {
      const client = await Client.findByPk(delivery.RecipientId);
      variables.firstName = client?.FirstName || client?.CompanyName || "";
    } else if (delivery.RecipientType === RECIPIENT_TYPES.TENANT && delivery.RecipientId) {
      const tenant = await Tenant.findByPk(delivery.RecipientId);
      variables.firstName = tenant?.FirstName || "";
    }

    return variables;
  }

  /** Ferme les batches dont plus aucune livraison n'est en attente. */
  async closeFinishedBatches(batchIds) {
    const uniqueIds = [...new Set(batchIds)];
    for (const batchId of uniqueIds) {
      const pending = await NotificationDelivery.count({
        where: {
          BatchId: batchId,
          Status: { [Op.in]: [DELIVERY_STATUS.QUEUED, DELIVERY_STATUS.SENDING] }
        }
      });
      if (pending > 0) continue;

      const [sent, failed, skipped] = await Promise.all([
        NotificationDelivery.count({ where: { BatchId: batchId, Status: DELIVERY_STATUS.SENT } }),
        NotificationDelivery.count({ where: { BatchId: batchId, Status: DELIVERY_STATUS.FAILED } }),
        NotificationDelivery.count({
          where: {
            BatchId: batchId,
            Status: { [Op.in]: [DELIVERY_STATUS.SKIPPED_NO_CONSENT, DELIVERY_STATUS.SUPPRESSED] }
          }
        })
      ]);

      await NotificationBatch.update(
        {
          Status: BATCH_STATUS.COMPLETED,
          SentCount: sent,
          FailedCount: failed,
          SkippedCount: skipped,
          CompletedAt: new Date()
        },
        { where: { Id: batchId } }
      );
      logger.info(`Batch ${batchId} complété | ${sent} envoyés, ${failed} échecs, ${skipped} ignorés`);
    }
  }
}

export const notificationWorker = new NotificationWorker();
