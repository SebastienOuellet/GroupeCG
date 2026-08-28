export const ROUTE_RUN_STATUS = {
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled"
};

export const ROUTE_RUN_STOP_STATUS = {
  PENDING: "pending",
  DONE: "done",
  SKIPPED: "skipped"
};

export const ROUTE_RUN_STOP_STATUSES = Object.values(ROUTE_RUN_STOP_STATUS);
