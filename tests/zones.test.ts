import { describe, it, expect } from "vitest";
import { ZoneClassifier } from "../src/zones/classifier";
import type { ProtectedZone } from "../src/zones/types";

const testZone: ProtectedZone = {
  id: "zone-restricted-01",
  name: "Fuel Storage Exclusion Zone",
  classification: "exclusion",
  boundary: {
    type: "polygon",
    coordinates: [
      { lat: 24.45, lng: 54.37 },
      { lat: 24.45, lng: 54.39 },
      { lat: 24.47, lng: 54.39 },
      { lat: 24.47, lng: 54.37 },
    ],
  },
};

describe("ZoneClassifier", () => {
  it("should classify a point within a zone", () => {
    const classifier = new ZoneClassifier();
    classifier.loadZones([testZone]);
    const result = classifier.classify({ lat: 24.46, lng: 54.38 });
    expect(result).not.toBeNull();
    expect(result!.id).toBe("zone-restricted-01");
  });

  it("should return null for point outside all zones", () => {
    const classifier = new ZoneClassifier();
    classifier.loadZones([testZone]);
    const result = classifier.classify({ lat: 25.0, lng: 55.0 });
    expect(result).toBeNull();
  });

  it("should detect violations in exclusion zones", () => {
    const classifier = new ZoneClassifier();
    classifier.loadZones([testZone]);
    const violations = classifier.checkViolations({ lat: 24.46, lng: 54.38 }, new Date().toISOString());
    expect(violations.length).toBe(1);
    expect(violations[0].classification).toBe("exclusion");
  });

  it("should filter zones by classification", () => {
    const classifier = new ZoneClassifier();
    classifier.loadZones([testZone]);
    expect(classifier.getZonesByClassification("exclusion").length).toBe(1);
    expect(classifier.getZonesByClassification("corridor").length).toBe(0);
  });
});
