import cron from "node-cron";
import db from "../../models/index.js";
import { logger } from "../config/logger.js";
import { ConfigService } from "../config/configService.js";
import * as notificationService from "../components/notification/notification.service.js";
import { CONTRACT_STATUS } from "../components/contract/contract.constants.js";
import { INVOICE_STATUS } from "../components/invoice/invoice.constants.js";
import { BATCH_TYPES, TARGET_TYPES } from "../components/notification/notification.constants.js";
import { TEMPLATE_TYPES } from "../components/template/template.model.js";
import { notificationWorker } from "../notifications/NotificationWorker.js";

const configService = new ConfigService();
const { Contract, Invoice, NotificationTemplate, Sequelize } = db;
const { Op } = Sequelize;

const CRON_TIMEZONE = "America/Toronto";

const todayStr = () => new Date().toISOString().slice(0, 10);
const addDaysStr = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const DEFAULT_RENEWAL_SMS = "Bonjour {{prenom}}, votre contrat de déneigement {{reference}} se termine bientôt. Contactez-nous pour renouveler.";
const DEFAULT_RENEWAL_SUBJECT = "Renouvellement de votre contrat de déneigement";
const DEFAULT_RENEWAL_EMAIL =
  "Bonjour {{prenom}},\n\nVotre contrat {{reference}} pour {{adresse}} se termine bientôt. Contactez-nous pour renouveler votre entente pour la prochaine saison.\n\nMerci de votre confiance.";

/**
 * Envoie un rappel aux clients dont le contrat actif se termine dans
 * RENEWAL_REMINDER_DAYS jours ou moins, une seule fois par contrat
 * (RenewalNoticeSentAt empêche le double envoi au tick suivant).
 */
export const runRenewalReminders = async () => {
  const reminderDays = configService.get("RENEWAL_REMINDER_DAYS");
  const cutoff = addDaysStr(reminderDays);

  const contracts = await Contract.findAll({
    where: {
      Status: CONTRACT_STATUS.ACTIVE,
      EndDate: { [Op.lte]: cutoff },
      RenewalNoticeSentAt: null
    }
  });

  const template = await NotificationTemplate.findOne({
    where: { Type: TEMPLATE_TYPES.RENEWAL, IsActive: true }
  });

  let sentCount = 0;
  for (const contract of contracts) {
    try {
      await notificationService.enqueueBatch({
        type: BATCH_TYPES.RENEWAL_REMINDER,
        targetType: TARGET_TYPES.CONTRACT,
        targetId: contract.Id,
        templateId: template?.Id ?? null,
        smsBody: template ? undefined : DEFAULT_RENEWAL_SMS,
        emailSubject: template ? undefined : DEFAULT_RENEWAL_SUBJECT,
        emailBody: template ? undefined : DEFAULT_RENEWAL_EMAIL,
        useSms: template ? !!template.SmsBody : true,
        useEmail: template ? !!(template.EmailSubject && template.EmailBody) : true,
        createdByUserId: null
      });
      contract.RenewalNoticeSentAt = new Date();
      await contract.save();
      sentCount += 1;
    } catch (error) {
      logger.error(`Rappel de renouvellement échoué pour ${contract.Reference}: ${error.message}`);
    }
  }

  logger.info(`Rappels de renouvellement: ${sentCount}/${contracts.length} contrat(s) traité(s).`);
  return { total: contracts.length, sent: sentCount };
};

/** Bascule les factures envoyées et échues en `overdue`. */
export const runOverdueInvoices = async () => {
  const [count] = await Invoice.update(
    { Status: INVOICE_STATUS.OVERDUE },
    { where: { Status: INVOICE_STATUS.SENT, DueDate: { [Op.lt]: todayStr() } } }
  );
  if (count > 0) {
    logger.info(`Factures en retard: ${count} facture(s) passée(s) à "overdue".`);
  }
  return { count };
};

/** Clôture les contrats actifs dont la saison est terminée depuis 30+ jours. */
export const runSeasonCompletion = async () => {
  const cutoff = addDaysStr(-30);
  const [count] = await Contract.update(
    { Status: CONTRACT_STATUS.COMPLETED },
    { where: { Status: CONTRACT_STATUS.ACTIVE, EndDate: { [Op.lt]: cutoff } } }
  );
  if (count > 0) {
    logger.info(`Fin de saison: ${count} contrat(s) passé(s) à "completed".`);
  }
  return { count };
};

/** Filet de sécurité supplémentaire au recovery fait au démarrage du worker. */
export const runQueueRecovery = () => notificationWorker.recoverStuck();

const guarded = (name, fn) => async () => {
  try {
    await fn();
  } catch (error) {
    logger.error(`Tâche planifiée "${name}" en échec: ${error.message}`);
  }
};

export const registerCronJobs = () => {
  cron.schedule("0 8 * * *", guarded("renewal-reminders", runRenewalReminders), { timezone: CRON_TIMEZONE });
  cron.schedule("0 6 * * *", guarded("overdue-invoices", runOverdueInvoices), { timezone: CRON_TIMEZONE });
  cron.schedule("5 6 * * *", guarded("season-completion", runSeasonCompletion), { timezone: CRON_TIMEZONE });
  cron.schedule("0 * * * *", guarded("queue-recovery", runQueueRecovery), { timezone: CRON_TIMEZONE });
  logger.info("Tâches planifiées enregistrées (rappels, factures, saison, file).");
};
