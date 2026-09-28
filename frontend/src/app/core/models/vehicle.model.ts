/** Tracteur suivi par GPS (Traccar Client ou ESP32, protocole OsmAnd). */
export interface Vehicle {
  Id: number;
  Name: string;
  Notes: string | null;
  SourceType: "osmand" | "fieldops";
  IsActive: boolean;
  /** Un jeton d'appareil a été généré (le jeton lui-même n'est montré qu'une fois). */
  HasToken: boolean;
  DeviceTokenCreatedAt: string | null;
  LastPositionAt: string | null;
  LastLatitude: string | null;
  LastLongitude: string | null;
  LastSpeedKmh: string | null;
  LastBatteryPercent: number | null;
  DefaultForRoutes?: { Id: number; Name: string }[];
  CurrentRun?: { Id: number; RouteId: number; StartedAt: string; Route?: { Id: number; Name: string } } | null;
}

export interface VehicleInput {
  Name: string;
  Notes?: string | null;
  IsActive?: boolean;
}

export interface DeviceTokenResponse {
  vehicle: Vehicle;
  /** Montré une seule fois : à copier dans Traccar Client (ou le firmware de l'ESP32). */
  token: string;
}

/** Choix du tracteur au démarrage d'une tournée. */
export interface AvailableVehicle {
  Id: number;
  Name: string;
  LastPositionAt: string | null;
  /** Nom de la route où ce tracteur roule déjà (null = libre). */
  InUseByRoute: string | null;
}
