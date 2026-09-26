import { DrivewaySurface } from "./driveway-surface";

export interface Client {
  Id: number;
  ClientNumber: number;
  FirstName: string | null;
  LastName: string | null;
  CompanyName: string | null;
  Email: string | null;
  Phone: string | null;
  SmsConsent: boolean;
  EmailConsent: boolean;
  VoiceConsent: boolean;
  Notes: string | null;
  IsActive: boolean;
  ServiceAddresses?: ServiceAddress[];
  Contracts?: Contract[];
}

export interface ServiceAddress {
  Id: number;
  ClientId: number;
  CivicNumber: string;
  Street: string;
  City: string;
  PostalCode: string;
  /** DECIMAL côté PostgreSQL : Sequelize le renvoie en chaîne. */
  Latitude: number | string | null;
  Longitude: number | string | null;
  DrivewaySurface: DrivewaySurface | null;
  Notes: string | null;
  IsActive: boolean;
  Tenants?: Tenant[];
  Contracts?: Contract[];
}

export interface RouteModel {
  Id: number;
  Name: string;
  Description: string | null;
  OperatorUserId: number | null;
  SortOrder: number;
  IsActive: boolean;
  Operator?: { Id: number; Name: string | null; Email: string } | null;
}

export type ContractStatus = "draft" | "active" | "completed" | "cancelled";

export interface ContractItem {
  Id?: number;
  Description: string;
  /** DECIMAL : chaîne quand elle vient de l'API, nombre quand saisie dans le formulaire. */
  Quantity: number | string;
  UnitPrice: number | string | null;
}

/** Que faire de la facture en cours quand les lignes du contrat changent. */
export type ContractInvoiceAction = "none" | "update" | "replace";

export interface InvoiceSync {
  action: "unchanged" | "updated" | "replaced" | "created" | "cancelled";
  invoiceNumber: string | null;
}

export interface Contract {
  Id: number;
  Reference: string;
  ContractNumber: number;
  ClientId: number;
  ServiceAddressId: number;
  RouteId: number | null;
  SeasonStartYear: number;
  StartDate: string;
  EndDate: string;
  /** Sous-total avant taxes (somme des lignes). */
  Price: string;
  Status: ContractStatus;
  RenewedFromContractId: number | null;
  RenewalNoticeSentAt: string | null;
  Notes: string | null;
  Client?: Client;
  ServiceAddress?: ServiceAddress;
  Route?: RouteModel | null;
  Items?: ContractItem[];
  /** Paiements non annulés (liste des contrats seulement). */
  Invoices?: { Id: number; Status: string; Amount: string }[];
  /** Présent dans la réponse d'une modification. */
  InvoiceSync?: InvoiceSync;
}

export type ContractUpdate = Partial<Omit<Contract, "Items">> & {
  Items?: ContractItem[];
  invoiceAction?: ContractInvoiceAction;
};

export interface Tenant {
  Id: number;
  ServiceAddressId: number;
  FirstName: string | null;
  LastName: string | null;
  Phone: string | null;
  Email: string | null;
  SmsConsent: boolean;
  EmailConsent: boolean;
  VoiceConsent: boolean;
  ConsentSource: string;
  IsActive: boolean;
}

export interface RolloverResult {
  targetYear: number;
  createdCount: number;
  skipped: { reference: string; reason: string }[];
  created: Contract[];
}
