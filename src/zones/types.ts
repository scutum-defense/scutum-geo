export interface GeoPoint {
  lat: number;
  lng: number;
  alt?: number;
}

export interface GeoBoundary {
  type: "polygon";
  coordinates: GeoPoint[];
}

export type ZoneClassification =
  | "restricted"
  | "controlled"
  | "monitored"
  | "exclusion"
  | "buffer"
  | "corridor";

export interface ProtectedZone {
  id: string;
  name: string;
  classification: ZoneClassification;
  boundary: GeoBoundary;
  altitude?: { floor: number; ceiling: number };
  metadata?: Record<string, unknown>;
}

export interface ZoneViolation {
  zoneId: string;
  zoneName: string;
  classification: ZoneClassification;
  point: GeoPoint;
  distance: number;
  timestamp: string;
}
