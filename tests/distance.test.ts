import { describe, it, expect } from "vitest";
import { haversineDistance, isPointInPolygon, bearing } from "../src/proximity/distance";

describe("haversineDistance", () => {
  it("should return 0 for same point", () => {
    const p = { lat: 24.4539, lng: 54.3773 }; // Abu Dhabi
    expect(haversineDistance(p, p)).toBeCloseTo(0, 0);
  });

  it("should calculate distance between Abu Dhabi and Dubai", () => {
    const abuDhabi = { lat: 24.4539, lng: 54.3773 };
    const dubai = { lat: 25.2048, lng: 55.2708 };
    const distance = haversineDistance(abuDhabi, dubai);
    expect(distance).toBeGreaterThan(120000); // ~125km
    expect(distance).toBeLessThan(140000);
  });

  it("should be symmetric", () => {
    const a = { lat: 24.4539, lng: 54.3773 };
    const b = { lat: 25.2048, lng: 55.2708 };
    expect(haversineDistance(a, b)).toBeCloseTo(haversineDistance(b, a), 0);
  });
});

describe("isPointInPolygon", () => {
  const square = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 10 },
    { lat: 10, lng: 10 },
    { lat: 10, lng: 0 },
  ];

  it("should return true for point inside polygon", () => {
    expect(isPointInPolygon({ lat: 5, lng: 5 }, square)).toBe(true);
  });

  it("should return false for point outside polygon", () => {
    expect(isPointInPolygon({ lat: 15, lng: 15 }, square)).toBe(false);
  });

  it("should return false for point far outside", () => {
    expect(isPointInPolygon({ lat: -10, lng: -10 }, square)).toBe(false);
  });
});

describe("bearing", () => {
  it("should return ~0 for due north", () => {
    const from = { lat: 0, lng: 0 };
    const to = { lat: 10, lng: 0 };
    expect(bearing(from, to)).toBeCloseTo(0, 0);
  });

  it("should return ~90 for due east", () => {
    const from = { lat: 0, lng: 0 };
    const to = { lat: 0, lng: 10 };
    expect(bearing(from, to)).toBeCloseTo(90, 0);
  });
});
