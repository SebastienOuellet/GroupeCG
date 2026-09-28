import { Contract, Tenant } from "./domain.model";
import { Suppressions } from "./consent";

export interface PortalLoginRequest {
  reference: string;
  contractNumber: number;
}

export interface PortalLoginResponse {
  token: string;
}

export interface PortalMe {
  contract: Pick<Contract, "Reference" | "ContractNumber" | "SeasonStartYear" | "Status" | "StartDate" | "EndDate">;
  client: {
    FirstName: string | null;
    LastName: string | null;
    CompanyName: string | null;
    Email: string | null;
    Phone: string | null;
    SmsConsent: boolean;
    EmailConsent: boolean;
    Suppressions: Suppressions;
  };
  serviceAddress: {
    CivicNumber: string;
    Street: string;
    City: string;
    PostalCode: string;
  };
  tenants: Tenant[];
}

/** Suivi du déneigement pour le client connecté (son adresse seulement). */
export interface PortalTracking {
  /** Suivi désactivé par l'entreprise (Paramètres › Véhicules). */
  enabled: boolean;
  /** Tournée en cours qui passe chez lui, ou sa dernière visite des 12 dernières heures ; null = rien à montrer. */
  visit: {
    inProgress: boolean;
    startedAt: string;
    status: "pending" | "done" | "skipped";
    doneAt: string | null;
    confirmedByGps: boolean;
    tractorHere: boolean;
    stopsBefore: number;
    tractor: { latitude: number; longitude: number; heading: number | null; recordedAt: string; isStale: boolean } | null;
    destination: { latitude: number; longitude: number } | null;
  } | null;
}
