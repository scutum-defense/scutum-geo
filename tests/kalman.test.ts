import { describe, it, expect } from "vitest";
import { KalmanTracker } from "../src/tracking/kalman";
import { haversineDistance } from "../src/proximity/distance";
import type { GeoPoint } from "../src/zones/types";

const DEG_TO_M = 111_320;

/** Generate noisy observations of a target moving at constant velocity. */
function simulateTrack(
  start: GeoPoint,
  vE: number,
  vN: number,
  steps: number,
  dtMs: number,
  noiseM: number,
  seed = 42
): Array<{ point: GeoPoint; t: number }> {
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296 - 0.5;
  };
  const obs: Array<{ point: GeoPoint; t: number }> = [];
  const latM = DEG_TO_M;
  const lngM = DEG_TO_M * Math.cos((start.lat * Math.PI) / 180);
  for (let i = 0; i < steps; i++) {
    const t = i * dtMs;
    obs.push({
      point: {
        lat: start.lat + (vN * (t / 1000)) / latM + (rand() * 2 * noiseM) / latM,
        lng: start.lng + (vE * (t / 1000)) / lngM + (rand() * 2 * noiseM) / lngM,
      },
      t,
    });
  }
  return obs;
}

describe("KalmanTracker", () => {
  it("initializes from the first observation", () => {
    const tracker = new KalmanTracker();
    expect(tracker.isInitialized()).toBe(false);
    tracker.update({ lat: 24.5, lng: 54.4 }, 0);
    expect(tracker.isInitialized()).toBe(true);
    expect(tracker.getState()?.lat).toBeCloseTo(24.5, 5);
    expect(tracker.getState()?.lng).toBeCloseTo(54.4, 5);
  });

  it("converges to the true velocity of a constant-velocity target", () => {
    const vE = 8;
    const vN = 6;
    const obs = simulateTrack({ lat: 24.5, lng: 54.4 }, vE, vN, 60, 1000, 30);
    const tracker = new KalmanTracker({ measurementNoise: 30, processNoise: 0.5 });
    for (const o of obs) tracker.update(o.point, o.t);
    const state = tracker.getState()!;
    expect(state.vE).toBeGreaterThan(vE * 0.7);
    expect(state.vE).toBeLessThan(vE * 1.3);
    expect(state.vN).toBeGreaterThan(vN * 0.7);
    expect(state.vN).toBeLessThan(vN * 1.3);
  });

  it("smooths noisy observations better than raw last-position", () => {
    const obs = simulateTrack({ lat: 24.5, lng: 54.4 }, 5, 5, 80, 1000, 60, 7);
    const tracker = new KalmanTracker({ measurementNoise: 60, processNoise: 0.2 });
    const truth = { lat: 24.5 + (5 * 79) / DEG_TO_M, lng: 54.4 + (5 * 79) / (DEG_TO_M * Math.cos((24.5 * Math.PI) / 180)) };
    for (const o of obs) tracker.update(o.point, o.t);
    const filteredError = haversineDistance(
      { lat: tracker.getState()!.lat, lng: tracker.getState()!.lng },
      truth
    );
    const rawError = haversineDistance(obs[obs.length - 1].point, truth);
    expect(filteredError).toBeLessThan(rawError);
  });

  it("estimates speed and course", () => {
    const obs = simulateTrack({ lat: 24.5, lng: 54.4 }, 10, 0, 40, 1000, 5);
    const tracker = new KalmanTracker({ measurementNoise: 5, processNoise: 0.5 });
    for (const o of obs) tracker.update(o.point, o.t);
    expect(tracker.speed()).toBeGreaterThan(8);
    expect(tracker.speed()).toBeLessThan(12);
    // due east => course ~90 deg
    expect(tracker.course()).toBeGreaterThan(80);
    expect(tracker.course()).toBeLessThan(100);
  });

  it("predicts forward along the velocity vector", () => {
    const start = { lat: 24.5, lng: 54.4 };
    const vE = 5;
    const vN = 5;
    const obs = simulateTrack(start, vE, vN, 40, 1000, 5);
    const tracker = new KalmanTracker();
    for (const o of obs) tracker.update(o.point, o.t);
    const t = obs[obs.length - 1].t;
    const projected = tracker.projected(10_000)!;
    const latM = DEG_TO_M;
    const lngM = DEG_TO_M * Math.cos((start.lat * Math.PI) / 180);
    const truth = {
      lat: start.lat + (vN * ((t + 10_000) / 1000)) / latM,
      lng: start.lng + (vE * ((t + 10_000) / 1000)) / lngM,
    };
    const err = haversineDistance(projected, truth);
    expect(err).toBeLessThan(300);
  });

  it("predict does not move the state backwards for late timestamps", () => {
    const tracker = new KalmanTracker();
    tracker.update({ lat: 24.5, lng: 54.4 }, 10_000);
    const before = tracker.getState();
    tracker.predict(5_000);
    expect(tracker.getState()).toEqual(before);
  });
});
