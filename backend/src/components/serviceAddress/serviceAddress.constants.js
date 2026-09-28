/** Revêtement de l'entrée : l'opérateur ajuste la lame (gravier = lame relevée, pavé uni = attention aux joints). */
export const DRIVEWAY_SURFACE = {
  PAVERS: "pavers",
  GRAVEL: "gravel",
  ASPHALT: "asphalt",
  CONCRETE: "concrete",
  OTHER: "other"
};

export const DRIVEWAY_SURFACES = Object.values(DRIVEWAY_SURFACE);

/**
 * Provenance des coordonnées. Google (autocomplete ou recherche texte) : cache daté,
 * seul le PlaceId est stockable indéfiniment. Pin corrigé à la main : notre propre donnée.
 */
export const LOCATION_SOURCE = {
  GOOGLE_PLACES: "google_places",
  MANUAL_PIN: "manual_pin"
};

export const LOCATION_SOURCES = Object.values(LOCATION_SOURCE);
