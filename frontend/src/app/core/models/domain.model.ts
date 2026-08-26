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
  Price: string;
  Status: ContractStatus;
  RenewedFromContractId: number | null;
  RenewalNoticeSentAt: string | null;
  Notes: string | null;
  Client?: Client;
  ServiceAddress?: ServiceAddress;
  Route?: RouteModel | null;
}

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
