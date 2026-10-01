import type { GeoPoint } from "../zones/types";
import { bearing, haversineDistance, destinationPoint } from "./distance";

export interface ThreatCorridor {
  origin: GeoPoint;
  bearing: number;
  speedMps: number;
  projectedPath: GeoPoint[];
  affectedZoneIds: string[];
  timeToImpactSeconds: number;
}

export function projectThreatCorridor(
  positions: Array<{ point: GeoPoint; timestamp: string }>,
  projectionSeconds: number = 300
): ThreatCorridor | null {
  if (positions.length < 2) return null;

  const last = positions[positions.length - 1];
  const prev = positions[positions.length - 2];

  const dist = haversineDistance(prev.point, last.point);
  const timeDelta = (new Date(last.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000;
  if (timeDelta <= 0) return null;

  const speed = dist / timeDelta;
  const hdg = bearing(prev.point, last.point);

  const projectedPath: GeoPoint[] = [];
  for (let t = 0; t <= projectionSeconds; t += 30) {
    projectedPath.push(destinationPoint(last.point, hdg, speed * t));
  }

  return {
    origin: last.point,
    bearing: hdg,
    speedMps: speed,
    projectedPath,
    affectedZoneIds: [],
    timeToImpactSeconds: 0,
  };
}
