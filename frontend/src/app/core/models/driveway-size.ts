/** Miroir de DRIVEWAY_SIZE (backend/src/components/serviceAddress/serviceAddress.constants.js) */
export const DRIVEWAY_SIZE = {
  SINGLE: "single",
  DOUBLE: "double",
  TRIPLE: "triple",
  LARGE: "large"
} as const;

export type DrivewaySize = (typeof DRIVEWAY_SIZE)[keyof typeof DRIVEWAY_SIZE];

export const DRIVEWAY_SIZE_LABELS: Record<DrivewaySize, string> = {
  single: "Simple",
  double: "Double",
  triple: "Triple",
  large: "Grande / commerciale"
};

export const DRIVEWAY_SIZE_OPTIONS = Object.values(DRIVEWAY_SIZE).map((value) => ({ value, label: DRIVEWAY_SIZE_LABELS[value] }));
