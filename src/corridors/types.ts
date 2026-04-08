import type { GeoPoint } from "../zones/types";

export interface Corridor {
  id: string;
  name: string;
  type: "maritime" | "aerial" | "ground" | "pipeline";
  waypoints: GeoPoint[];
  width: number; // meters
  metadata?: Record<string, unknown>;
}

export interface CorridorDeviation {
  corridorId: string;
  corridorName: string;
  point: GeoPoint;
  deviationMeters: number;
  nearestWaypointIndex: number;
  timestamp: string;
}
