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

/** Qui a marqué l'arrêt fait ou passé. */
export const STOP_DONE_SOURCE = {
  MANUAL: "manual",
  /** Géorepérage : le tracteur est reparti de l'entrée après y être resté assez longtemps. */
  AUTO_GPS: "auto_gps"
};
