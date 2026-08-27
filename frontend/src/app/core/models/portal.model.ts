import { Contract, Tenant } from "./domain.model";

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
  };
  serviceAddress: {
    CivicNumber: string;
    Street: string;
    City: string;
    PostalCode: string;
  };
  tenants: Tenant[];
}
