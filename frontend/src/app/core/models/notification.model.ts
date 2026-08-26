export type TemplateType = "storm" | "route_start" | "renewal" | "custom";

export interface NotificationTemplate {
  Id: number;
  Name: string;
  Type: TemplateType;
  SmsBody: string | null;
  EmailSubject: string | null;
  EmailBody: string | null;
  IsActive: boolean;
}

export type BatchStatus = "pending" | "processing" | "completed" | "failed";
export type TargetType = "route" | "contract" | "all";

export interface NotificationBatch {
  Id: number;
  Type: string;
  TargetType: TargetType;
  TargetId: number | null;
  TemplateId: number | null;
  SmsBody: string | null;
  EmailSubject: string | null;
  EmailBody: string | null;
  UseSms: boolean;
  UseEmail: boolean;
  Status: BatchStatus;
  TotalCount: number;
  SentCount: number;
  FailedCount: number;
  SkippedCount: number;
  CompletedAt: string | null;
  createdAt: string;
  CreatedBy?: { Id: number; Name: string | null; Email: string } | null;
  Template?: { Id: number; Name: string } | null;
}

export type DeliveryStatus = "queued" | "sending" | "sent" | "failed" | "skipped_no_consent" | "suppressed";

export interface NotificationDelivery {
  Id: number;
  BatchId: number;
  Channel: "sms" | "email";
  RecipientType: "client" | "tenant";
  RecipientId: number | null;
  ContactAddress: string;
  ContractId: number | null;
  Status: DeliveryStatus;
  Attempts: number;
  LastError: string | null;
  SentAt: string | null;
}

export interface SendNotificationRequest {
  targetType: TargetType;
  targetId?: number | null;
  templateId?: number | null;
  smsBody?: string;
  emailSubject?: string;
  emailBody?: string;
  useSms: boolean;
  useEmail: boolean;
}
