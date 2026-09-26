import { TAX_RATES } from "./invoice.constants.js";
import { BadRequestError } from "../../errors/Errors.js";

const MAX_DESCRIPTION_LENGTH = 200;

/**
 * Calculs monétaires en cents entiers (jamais de flottants cumulés).
 * DECIMAL arrive de PostgreSQL en chaîne : tout passe par toCents().
 */
export const toCents = (value) => Math.round(Number(value) * 100);
export const fromCents = (cents) => (cents / 100).toFixed(2);

/**
 * @param {{Description: string, Quantity: number|string, UnitPrice: number|string}[]} items
 * @returns lignes avec LineTotal + sous-total, TPS, TVQ et total (chaînes "123.45")
 */
export const computeTotals = (items) => {
  const lines = items.map((item, index) => {
    const lineCents = Math.round(Number(item.Quantity) * toCents(item.UnitPrice));
    return {
      Description: item.Description,
      Quantity: Number(item.Quantity).toFixed(2),
      UnitPrice: fromCents(toCents(item.UnitPrice)),
      LineTotal: fromCents(lineCents),
      SortOrder: index,
      lineCents
    };
  });

  const subtotalCents = lines.reduce((sum, line) => sum + line.lineCents, 0);
  const tpsCents = Math.round(subtotalCents * TAX_RATES.TPS);
  const tvqCents = Math.round(subtotalCents * TAX_RATES.TVQ);

  return {
    lines: lines.map(({ lineCents, ...line }) => line),
    subtotal: fromCents(subtotalCents),
    tps: fromCents(tpsCents),
    tvq: fromCents(tvqCents),
    total: fromCents(subtotalCents + tpsCents + tvqCents)
  };
};

/**
 * Valide des lignes saisies (contrat ou facture de service) :
 * lignes entièrement vides ignorées, puis description requise,
 * quantité > 0 (défaut 1), prix unitaire >= 0.
 */
const isBlank = (value) => value === undefined || value === null || String(value).trim() === "";

/** Ligne ajoutée puis laissée vide (ni description ni prix) : ignorée plutôt que refusée. */
const isBlankLine = (item) => isBlank(item?.Description) && isBlank(item?.UnitPrice);

export const normalizeLineItems = (items, emptyMessage = "Au moins une ligne est requise.") => {
  const filled = Array.isArray(items) ? items.filter((item) => !isBlankLine(item)) : [];
  if (filled.length === 0) {
    throw new BadRequestError(emptyMessage);
  }

  return filled.map((item, index) => {
    const description = String(item.Description ?? "").trim();
    const quantity = item.Quantity === undefined || item.Quantity === null || item.Quantity === "" ? 1 : Number(item.Quantity);
    const unitPrice = Number(item.UnitPrice);
    const position = `Élément ${index + 1}${description ? ` (« ${description} »)` : ""}`;

    if (!description) throw new BadRequestError(`${position} : la description est requise.`);
    if (description.length > MAX_DESCRIPTION_LENGTH) throw new BadRequestError(`${position} : description trop longue (${MAX_DESCRIPTION_LENGTH} car. max).`);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new BadRequestError(`${position} : la quantité doit être supérieure à 0.`);
    if (item.UnitPrice === "" || item.UnitPrice === null || !Number.isFinite(unitPrice) || unitPrice < 0) throw new BadRequestError(`${position} : prix invalide.`);

    return { Description: description, Quantity: quantity.toFixed(2), UnitPrice: unitPrice.toFixed(2), SortOrder: index };
  });
};
