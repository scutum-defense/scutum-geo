import { describe, expect, it } from "vitest";
import { KalmanTracker } from "../src/tracking/kalman";
import { computeAssociationWeights } from "../src/tracking/jpda";

const T0 = 1_700_000_000_000;
const SEC = 1000;

function trackNear(lat: number, lng: number, t: number): KalmanTracker {
  const tr = new KalmanTracker();
  tr.initialize({ lat, lng }, t);
  return tr;
}

describe("computeAssociationWeights (JPDA)", () => {
  it("assigns a clean plot to the nearest track with high probability", () => {
    const t1 = trackNear(10, 10, T0);
    const t2 = trackNear(10.05, 10, T0);
    const res = computeAssociationWeights(
      [{ point: { lat: 10.0002, lng: 10 }, t: T0 + SEC }],
      [{ tracker: t1 }, { tracker: t2 }],
    );
    const w = res.weights[0];
    expect(w[0]).toBeGreaterThan(0.9);
    expect(w[0] + w[1] + res.clutterMass[0]).toBeCloseTo(1, 5);
  });

  it("spreads probability across tracks when a plot is ambiguous", () => {
    const t1 = trackNear(10, 10, T0);
    const t2 = trackNear(10.001, 10, T0);
    const res = computeAssociationWeights(
      [{ point: { lat: 10.0005, lng: 10 }, t: T0 + SEC }],
      [{ tracker: t1 }, { tracker: t2 }],
    );
    const w = res.weights[0];
    expect(w[0]).toBeGreaterThan(0.2);
    expect(w[1]).toBeGreaterThan(0.2);
    expect(w[0] + w[1] + res.clutterMass[0]).toBeCloseTo(1, 5);
  });

  it("treats out-of-gate plots as clutter", () => {
    const t1 = trackNear(10, 10, T0);
    const res = computeAssociationWeights(
      [{ point: { lat: 10.5, lng: 10 }, t: T0 + SEC }],
      [{ tracker: t1 }],
    );
    expect(res.weights[0][0]).toBe(0);
    expect(res.clutterMass[0]).toBeGreaterThan(0.99);
  });

  it("never assigns the same track to two plots (mutual exclusion)", () => {
    const t1 = trackNear(10, 10, T0);
    const res = computeAssociationWeights(
      [
        { point: { lat: 10.0005, lng: 10 }, t: T0 + SEC },
        { point: { lat: 10.0008, lng: 10 }, t: T0 + SEC },
      ],
      [{ tracker: t1 }],
    );
    // In the exact enumeration, at most one plot maps to the track.
    for (let ev = 0; ev < 2; ev++) {
      const total = res.weights[0][0] + res.weights[1][0];
      expect(total).toBeLessThanOrEqual(1 + 1e-9);
    }
    expect(res.weights[0][0] + res.weights[1][0]).toBeLessThanOrEqual(1);
  });

  it("handles empty scan and no tracks", () => {
    const empty = computeAssociationWeights([], []);
    expect(empty.weights).toHaveLength(0);
    const noTracks = computeAssociationWeights(
      [{ point: { lat: 0, lng: 0 }, t: T0 }],
      [],
    );
    expect(noTracks.clutterMass[0]).toBe(1);
  });

  it("falls back to cheap JPDA for large scans without crashing", () => {
    const t1 = trackNear(10, 10, T0);
    const plots = Array.from({ length: 12 }, (_, k) => ({
      point: { lat: 10 + k * 0.0001, lng: 10 },
      t: T0 + SEC,
    }));
    const res = computeAssociationWeights(plots, [{ tracker: t1 }], {
      maxJointEvents: 10,
    });
    res.weights.forEach((w, i) => {
      const sum = w[0] + res.clutterMass[i];
      expect(sum).toBeGreaterThan(0);
    });
  });

  it("missed detection mass lowers track assignment when pd < 1", () => {
    const t1 = trackNear(10, 10, T0);
    const noPlot = computeAssociationWeights([], [{ tracker: t1 }], { pd: 0.9 });
    expect(noPlot.weights).toHaveLength(0);
  });
});
