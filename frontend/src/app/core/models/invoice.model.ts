import { Contract } from "./domain.model";

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

export interface Invoice {
  Id: number;
  ContractId: number;
  InvoiceNumber: string;
  Amount: string;
  Status: InvoiceStatus;
  IssuedAt: string | null;
  DueDate: string | null;
  PaidAt: string | null;
  Notes: string | null;
  Contract?: Contract;
}
