export const INVOICE_STATUS = {
  DRAFT: "draft",
  SENT: "sent",
  PAID: "paid",
  OVERDUE: "overdue",
  CANCELLED: "cancelled"
};

export const INVOICE_STATUSES = Object.values(INVOICE_STATUS);

/**
 * CONTRACT : montant à payer du contrat saisonnier, généré et tenu à jour
 *            depuis les lignes du contrat (le contrat fait office de facture).
 * SERVICE  : travaux ponctuels hors contrat, lignes saisies à la main.
 */
export const INVOICE_TYPE = {
  CONTRACT: "contract",
  SERVICE: "service"
};

export const INVOICE_TYPES = Object.values(INVOICE_TYPE);

/** Envoyée au client : le contenu (lignes, montants) est figé. On annule et on remplace. */
export const INVOICE_ISSUED_STATUSES = [INVOICE_STATUS.SENT, INVOICE_STATUS.OVERDUE];

/**
 * Taux de taxes du Québec, appliqués au sous-total avant taxes.
 * Les montants calculés sont figés sur chaque facture : changer un taux
 * n'affecte que les factures générées ensuite.
 */
export const TAX_RATES = {
  TPS: 0.05,
  TVQ: 0.09975
};

/** Délai de paiement par défaut quand une facture est marquée envoyée sans échéance. */
export const DEFAULT_PAYMENT_TERMS_DAYS = 30;

/** Que faire de la facture en cours quand on modifie les lignes d'un contrat. */
export const CONTRACT_INVOICE_ACTION = {
  NONE: "none",
  UPDATE: "update",
  REPLACE: "replace"
};

export const CONTRACT_INVOICE_ACTIONS = Object.values(CONTRACT_INVOICE_ACTION);
