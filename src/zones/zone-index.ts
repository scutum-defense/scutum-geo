import type { GeoPoint, ProtectedZone } from "./types";

export interface ZoneIndexCell {
  /** Grid cells (col, row) covered by an indexed zone. */
  zoneId: string;
  cells: Array<[number, number]>;
}

/**
 * Uniform-grid spatial index over protected zones.
 *
 * The classifier's naive point-in-polygon scan is O(zones × vertices) per
 * query. This index prunes to only the zones whose bounding cells overlap
 * the query point's cell, which keeps per-query cost independent of the
 * total zone count for typical coastal/port geofence densities.
 */
export class ZoneIndex {
  private readonly cellSizeDeg: number;
  private readonly zones = new Map<string, ProtectedZone>();
  private readonly grid = new Map<string, Set<string>>();

  constructor(cellSizeDeg = 0.05) {
    if (cellSizeDeg <= 0) {
      throw new Error("cellSizeDeg must be > 0");
    }
    this.cellSizeDeg = cellSizeDeg;
  }

  private cellKey(lat: number, lng: number): string {
    const col = Math.floor(lng / this.cellSizeDeg);
    const row = Math.floor(lat / this.cellSizeDeg);
    return `${col}:${row}`;
  }

  private zoneCells(zone: ProtectedZone): Set<string> {
    const coords = zone.boundary.coordinates;
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    for (const p of coords) {
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
      minLng = Math.min(minLng, p.lng);
      maxLng = Math.max(maxLng, p.lng);
    }
    const cells = new Set<string>();
    for (
      let lat = Math.floor(minLat / this.cellSizeDeg) * this.cellSizeDeg;
      lat <= maxLat;
      lat += this.cellSizeDeg
    ) {
      for (
        let lng = Math.floor(minLng / this.cellSizeDeg) * this.cellSizeDeg;
        lng <= maxLng;
        lng += this.cellSizeDeg
      ) {
        cells.add(this.cellKey(lat, lng));
      }
    }
    return cells;
  }

  build(zones: ProtectedZone[]): void {
    this.zones.clear();
    this.grid.clear();
    for (const zone of zones) {
      this.zones.set(zone.id, zone);
      for (const cell of this.zoneCells(zone)) {
        let bucket = this.grid.get(cell);
        if (!bucket) {
          bucket = new Set();
          this.grid.set(cell, bucket);
        }
        bucket.add(zone.id);
      }
    }
  }

  /** Zone ids whose grid cells contain the query point's cell. */
  candidates(point: GeoPoint): ProtectedZone[] {
    const bucket = this.grid.get(this.cellKey(point.lat, point.lng));
    if (!bucket) return [];
    const result: ProtectedZone[] = [];
    for (const id of bucket) {
      const zone = this.zones.get(id);
      if (zone) result.push(zone);
    }
    return result;
  }

  /** Indexed zone count. */
  size(): number {
    return this.zones.size;
  }

  /** Total occupied grid cells (density diagnostics). */
  cellCount(): number {
    return this.grid.size;
  }
}
