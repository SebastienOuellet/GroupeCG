/** Miroir de backend/src/components/serviceAddress/serviceAddress.constants.js */
export const DRIVEWAY_SURFACE = {
  PAVERS: "pavers",
  GRAVEL: "gravel",
  ASPHALT: "asphalt",
  CONCRETE: "concrete",
  OTHER: "other"
} as const;

export type DrivewaySurface = (typeof DRIVEWAY_SURFACE)[keyof typeof DRIVEWAY_SURFACE];

export const DRIVEWAY_SURFACE_LABELS: Record<DrivewaySurface, string> = {
  pavers: "Pavé uni",
  gravel: "Gravier",
  asphalt: "Asphalte",
  concrete: "Béton",
  other: "Autre"
};

export const DRIVEWAY_SURFACE_OPTIONS = Object.values(DRIVEWAY_SURFACE).map((value) => ({
  value,
  label: DRIVEWAY_SURFACE_LABELS[value]
}));
