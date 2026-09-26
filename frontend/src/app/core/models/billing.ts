/**
 * Taxes du Québec — APERÇU seulement dans l'interface. Le backend
 * (invoice.constants.js / invoice.money.js) fait foi et fige les montants
 * sur chaque facture. Garder ces taux synchronisés.
 */
export const TAX_RATES = {
  TPS: 0.05,
  TVQ: 0.09975
} as const;

export interface ItemLike {
  Description: string;
  Quantity: number | string;
  UnitPrice: number | string | null;
}

export interface BillingTotals {
  subtotal: number;
  tps: number;
  tvq: number;
  total: number;
}

const isBlank = (value: unknown): boolean => value === undefined || value === null || String(value).trim() === "";

/** Retire les lignes ajoutées puis laissées vides (ni description ni prix). Le backend fait de même. */
export function withoutBlankItems<T extends ItemLike>(items: T[]): T[] {
  return items.filter((item) => !(isBlank(item.Description) && isBlank(item.UnitPrice)));
}

const toCents = (value: number | string | null | undefined): number => Math.round(Number(value || 0) * 100);

/** Même arrondi que le backend : en cents, taxes calculées sur le sous-total. */
export function lineTotal(item: ItemLike): number {
  return Math.round(Number(item.Quantity || 0) * toCents(item.UnitPrice)) / 100;
}

export function computeTotals(items: ItemLike[]): BillingTotals {
  const subtotalCents = items.reduce((sum, item) => sum + Math.round(Number(item.Quantity || 0) * toCents(item.UnitPrice)), 0);
  const tpsCents = Math.round(subtotalCents * TAX_RATES.TPS);
  const tvqCents = Math.round(subtotalCents * TAX_RATES.TVQ);
  return {
    subtotal: subtotalCents / 100,
    tps: tpsCents / 100,
    tvq: tvqCents / 100,
    total: (subtotalCents + tpsCents + tvqCents) / 100
  };
}

const moneyFormat = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" });

/** 1234.5 → « 1 234,50 $ » */
export function formatMoney(value: number | string | null | undefined): string {
  return moneyFormat.format(Number(value || 0));
}

/**
 * Montant à afficher pour un contrat : celui de son paiement en cours (figé)
 * s'il existe, sinon le prix des éléments + taxes. Toujours taxes incluses.
 */
export function contractAmount(price: number | string, activePaymentAmount?: number | string | null): number {
  if (activePaymentAmount !== undefined && activePaymentAmount !== null) return Number(activePaymentAmount);
  return computeTotals([{ Description: "", Quantity: 1, UnitPrice: price }]).total;
}
