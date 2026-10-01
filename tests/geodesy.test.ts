import { describe, it, expect } from "vitest";
import {
  haversineDistance,
  distanceToPolygon,
  distanceToSegment,
  destinationPoint,
  crossTrackDistance,
} from "../src/proximity/distance";
import { projectThreatCorridor } from "../src/proximity/threat-corridor";
import type { GeoPoint } from "../src/zones/types";

const p = (lat: number, lng: number): GeoPoint => ({ lat, lng });

describe("distanceToPolygon edge correctness", () => {
  it("measures distance to the nearest edge, not just vertices", () => {
    const square = [p(0, 0), p(0, 2), p(2, 2), p(2, 0)];
    const midEdge = p(-0.5, 1);
    const dist = distanceToPolygon(midEdge, square);
    const toNearestVertex = Math.min(
      haversineDistance(midEdge, square[0]),
      haversineDistance(midEdge, square[1])
    );
    expect(dist).toBeLessThan(toNearestVertex / 2);
  });

  it("returns 0 for points inside the polygon", () => {
    const square = [p(0, 0), p(0, 2), p(2, 2), p(2, 0)];
    expect(distanceToPolygon(p(1, 1), square)).toBe(0);
  });
});

describe("distanceToSegment", () => {
  it("returns cross-track distance for projections within the segment", () => {
    const a = p(0, 0);
    const b = p(0, 1);
    const point = p(0.01, 0.5);
    const dist = distanceToSegment(point, a, b);
    expect(dist).toBeGreaterThan(1000);
    expect(dist).toBeLessThan(1200);
  });

  it("returns endpoint distance beyond the segment ends", () => {
    const a = p(0, 0);
    const b = p(0, 0.01);
    const point = p(0, -0.05);
    const dist = distanceToSegment(point, a, b);
    expect(dist).toBeCloseTo(haversineDistance(point, a), -2);
  });
});

describe("crossTrackDistance", () => {
  it("is near zero for points on the path", () => {
    const a = p(0, 0);
    const b = p(1, 1);
    const onPath = p(0.5, 0.5);
    expect(Math.abs(crossTrackDistance(onPath, a, b))).toBeLessThan(200);
  });
});

describe("destinationPoint", () => {
  it("projects due north correctly", () => {
    const start = p(10, 10);
    const d = destinationPoint(start, 0, 111195);
    expect(d.lat).toBeCloseTo(11, 1);
    expect(d.lng).toBeCloseTo(10, 3);
  });

  it("round-trips with haversine distance", () => {
    const start = p(25, 55);
    const d = destinationPoint(start, 137, 50000);
    const back = haversineDistance(start, d);
    expect(back).toBeCloseTo(50000, -2);
  });

  it("normalizes longitude across the antimeridian", () => {
    const d = destinationPoint(p(10, 179.9), 90, 500000);
    expect(Math.abs(d.lng)).toBeLessThanOrEqual(180);
  });
});

describe("projectThreatCorridor", () => {
  it("projects along the observed bearing using great-circle math", () => {
    const positions = [
      { point: p(25, 55), timestamp: "2026-01-01T00:00:00Z" },
      { point: p(25.05, 55.05), timestamp: "2026-01-01T00:01:00Z" },
    ];
    const corridor = projectThreatCorridor(positions, 300);
    expect(corridor).not.toBeNull();
    expect(corridor!.projectedPath.length).toBeGreaterThan(5);
    expect(corridor!.speedMps).toBeGreaterThan(0);
    expect(corridor!.bearing).toBeGreaterThan(0);
    expect(corridor!.bearing).toBeLessThan(90);
    for (const wp of corridor!.projectedPath) {
      expect(Math.abs(wp.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(wp.lng)).toBeLessThanOrEqual(180);
    }
  });

  it("returns null for insufficient or non-monotonic data", () => {
    expect(projectThreatCorridor([])).toBeNull();
    const bad = [
      { point: p(25, 55), timestamp: "2026-01-01T00:01:00Z" },
      { point: p(25.05, 55.05), timestamp: "2026-01-01T00:00:00Z" },
    ];
    expect(projectThreatCorridor(bad)).toBeNull();
  });
});
