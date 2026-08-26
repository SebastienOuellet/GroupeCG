export const CHANNELS = {
  SMS: "sms",
  EMAIL: "email",
  VOICE: "voice"
};

export const BATCH_TYPES = {
  MANUAL: "manual",
  ROUTE_START: "route_start",
  RENEWAL_REMINDER: "renewal_reminder"
};

export const TARGET_TYPES = {
  ROUTE: "route",
  CONTRACT: "contract",
  ALL: "all"
};

export const BATCH_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed"
};

export const DELIVERY_STATUS = {
  QUEUED: "queued",
  SENDING: "sending",
  SENT: "sent",
  FAILED: "failed",
  SKIPPED_NO_CONSENT: "skipped_no_consent",
  SUPPRESSED: "suppressed"
};

export const RECIPIENT_TYPES = {
  CLIENT: "client",
  TENANT: "tenant"
};

export const MAX_DELIVERY_ATTEMPTS = 3;
