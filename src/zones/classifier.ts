import type { GeoPoint, ProtectedZone, ZoneViolation } from "./types";
import { isPointInPolygon, distanceToPolygon } from "../proximity/distance";

export class ZoneClassifier {
  private zones: ProtectedZone[] = [];

  loadZones(zones: ProtectedZone[]): void {
    this.zones = zones;
  }

  classify(point: GeoPoint): ProtectedZone | null {
    for (const zone of this.zones) {
      if (isPointInPolygon(point, zone.boundary.coordinates)) {
        return zone;
      }
    }
    return null;
  }

  checkViolations(point: GeoPoint, timestamp: string): ZoneViolation[] {
    const violations: ZoneViolation[] = [];

    for (const zone of this.zones) {
      if (zone.classification === "exclusion" || zone.classification === "restricted") {
        if (isPointInPolygon(point, zone.boundary.coordinates)) {
          violations.push({
            zoneId: zone.id,
            zoneName: zone.name,
            classification: zone.classification,
            point,
            distance: 0,
            timestamp,
          });
        }
      }
    }

    return violations;
  }

  getZonesByClassification(classification: string): ProtectedZone[] {
    return this.zones.filter((z) => z.classification === classification);
  }
}
