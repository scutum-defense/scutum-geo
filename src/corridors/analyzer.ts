import type { Corridor, CorridorDeviation } from "./types";
import type { GeoPoint } from "../zones/types";
import { haversineDistance } from "../proximity/distance";

export class CorridorAnalyzer {
  private corridors: Corridor[] = [];

  loadCorridors(corridors: Corridor[]): void {
    this.corridors = corridors;
  }

  checkDeviation(point: GeoPoint, timestamp: string): CorridorDeviation[] {
    const deviations: CorridorDeviation[] = [];

    for (const corridor of this.corridors) {
      let minDistance = Infinity;
      let nearestIdx = 0;

      for (let i = 0; i < corridor.waypoints.length; i++) {
        const dist = haversineDistance(point, corridor.waypoints[i]);
        if (dist < minDistance) {
          minDistance = dist;
          nearestIdx = i;
        }
      }

      if (minDistance > corridor.width) {
        deviations.push({
          corridorId: corridor.id,
          corridorName: corridor.name,
          point,
          deviationMeters: minDistance - corridor.width,
          nearestWaypointIndex: nearestIdx,
          timestamp,
        });
      }
    }

    return deviations;
  }
}
