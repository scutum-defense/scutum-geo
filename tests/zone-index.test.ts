import { describe, it, expect } from "vitest";
import { ZoneIndex } from "../src/zones/zone-index";
import { ZoneClassifier } from "../src/zones/classifier";
import type { GeoPoint, ProtectedZone } from "../src/zones/types";

function zone(id: string, classification: ProtectedZone["classification"], coords: Array<[number, number]>): ProtectedZone {
  return {
    id,
    name: id,
    classification,
    boundary: {
      type: "polygon",
      coordinates: coords.map(([lat, lng]) => ({ lat, lng })),
    },
  };
}

const zones = [
  zone("port-core", "restricted", [
    [24.50, 54.38],
    [24.52, 54.38],
    [24.52, 54.41],
    [24.50, 54.41],
  ]),
  zone("approach-lane", "monitored", [
    [24.55, 54.42],
    [24.60, 54.42],
    [24.60, 54.48],
    [24.55, 54.48],
  ]),
  zone("far-exclusion", "exclusion", [
    [25.10, 55.00],
    [25.20, 55.00],
    [25.20, 55.10],
    [25.10, 55.10],
  ]),
];

describe("ZoneIndex", () => {
  it("returns only zones overlapping the query cell", () => {
    const index = new ZoneIndex(0.05);
    index.build(zones);
    const inside: GeoPoint = { lat: 24.51, lng: 54.40 };
    const ids = index.candidates(inside).map((z) => z.id);
    expect(ids).toContain("port-core");
    expect(ids).not.toContain("far-exclusion");
  });

  it("returns nothing for points far from all zones", () => {
    const index = new ZoneIndex(0.05);
    index.build(zones);
    expect(index.candidates({ lat: 10, lng: 10 })).toHaveLength(0);
  });

  it("agrees with the naive classifier on containment across a grid of probes", () => {
    const index = new ZoneIndex(0.02);
    index.build(zones);
    const classifier = new ZoneClassifier();
    classifier.loadZones(zones);
    let probes = 0;
    let agreements = 0;
    for (let lat = 24.45; lat <= 25.25; lat += 0.01) {
      for (let lng = 54.35; lng <= 55.15; lng += 0.01) {
        const point: GeoPoint = { lat, lng };
        const naive = classifier.classify(point)?.id ?? null;
        const indexed = index.candidates(point).map((z) => z.id);
        const candidateMatch =
          naive === null || indexed.includes(naive);
        if (candidateMatch) agreements += 1;
        probes += 1;
      }
    }
    expect(probes).toBeGreaterThan(1000);
    expect(agreements).toBe(probes);
  });

  it("reports size and cell counts", () => {
    const index = new ZoneIndex(0.05);
    index.build(zones);
    expect(index.size()).toBe(3);
    expect(index.cellCount()).toBeGreaterThan(0);
  });

  it("rejects invalid cell sizes", () => {
    expect(() => new ZoneIndex(0)).toThrow(/cellSizeDeg/);
    expect(() => new ZoneIndex(-1)).toThrow(/cellSizeDeg/);
  });

  it("rebuild replaces previous contents", () => {
    const index = new ZoneIndex(0.05);
    index.build(zones);
    index.build([zones[0]]);
    expect(index.size()).toBe(1);
    expect(index.candidates({ lat: 24.57, lng: 54.45 })).toHaveLength(0);
  });
});
