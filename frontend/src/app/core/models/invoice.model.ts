import { Client, Contract } from "./domain.model";

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyée",
  paid: "Payée",
  overdue: "En retard",
  cancelled: "Annulée"
};

/** contract = montant à payer d'un contrat ; service = travaux hors contrat. */
export type InvoiceType = "contract" | "service";

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  contract: "Contrat",
  service: "Service"
};

/** Vocabulaire côté fiche contrat : le contrat fait office de facture. */
export const CONTRACT_PAYMENT_LABELS: Record<InvoiceStatus, string> = {
  draft: "À envoyer",
  sent: "À payer",
  paid: "Payé",
  overdue: "En retard",
  cancelled: "Annulé"
};

/** Envoyée au client : contenu figé, on annule et on remplace. */
export const ISSUED_STATUSES: InvoiceStatus[] = ["sent", "overdue"];

export interface InvoiceLine {
  Id: number;
  Description: string;
  Quantity: string;
  UnitPrice: string;
  LineTotal: string;
  SortOrder: number;
}

export interface Invoice {
  Id: number;
  Type: InvoiceType;
  ClientId: number;
  /** Null pour une facture de service. */
  ContractId: number | null;
  InvoiceNumber: string;
  /** Montants DECIMAL renvoyés en chaîne par PostgreSQL. Amount = total taxes incluses. */
  Subtotal: string;
  TpsAmount: string;
  TvqAmount: string;
  Amount: string;
  Status: InvoiceStatus;
  IssuedAt: string | null;
  DueDate: string | null;
  PaidAt: string | null;
  CancelledAt: string | null;
  ReplacesInvoiceId: number | null;
  Notes: string | null;
  Client?: Client;
  Contract?: Contract | null;
  Lines?: InvoiceLine[];
  ReplacesInvoice?: { Id: number; InvoiceNumber: string } | null;
}
