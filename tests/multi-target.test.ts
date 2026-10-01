import { describe, expect, it } from "vitest";
import { MultiTargetTracker } from "../src/tracking/multi-target";

const T0 = 1_700_000_000_000;
const SEC = 1000;

describe("MultiTargetTracker", () => {
  it("spawns tentative tracks for new plots and confirms after enough hits", () => {
    const mt = new MultiTargetTracker({ confirmHits: 2 });
    let s = mt.scan([{ point: { lat: 10, lng: 10 }, t: T0 }], T0);
    expect(s).toHaveLength(1);
    expect(s[0].status).toBe("tentative");
    s = mt.scan([{ point: { lat: 10.001, lng: 10 }, t: T0 + SEC }], T0 + SEC);
    expect(s).toHaveLength(1);
    expect(s[0].status).toBe("confirmed");
    expect(s[0].hits).toBe(2);
  });

  it("maintains two separate tracks for two moving targets", () => {
    const mt = new MultiTargetTracker({ confirmHits: 2, gateM: 500 });
    const a = { lat: 10, lng: 10 };
    const b = { lat: 10.05, lng: 10 };
    let states = mt.scan(
      [
        { point: a, t: T0 },
        { point: b, t: T0 },
      ],
      T0,
    );
    expect(states).toHaveLength(2);
    for (let k = 1; k <= 5; k++) {
      states = mt.scan(
        [
          { point: { lat: a.lat + 0.001 * k, lng: 10 }, t: T0 + k * SEC },
          { point: { lat: b.lat + 0.001 * k, lng: 10 }, t: T0 + k * SEC },
        ],
        T0 + k * SEC,
      );
    }
    expect(states).toHaveLength(2);
    const lats = states.map((s) => s.state!.lat).sort();
    expect(lats[1] - lats[0]).toBeGreaterThan(0.03);
  });

  it("coasts a track through a missed scan and re-associates on return", () => {
    const mt = new MultiTargetTracker({ confirmHits: 1, maxMisses: 2, gateM: 800 });
    mt.scan([{ point: { lat: 10, lng: 10 }, t: T0 }], T0);
    const moving = { lat: 10.0015, lng: 10 };
    let s = mt.scan([{ point: moving, t: T0 + 2 * SEC }], T0 + 2 * SEC);
    expect(s).toHaveLength(1);
    expect(s[0].status).toBe("confirmed");
    s = mt.scan([], T0 + 3 * SEC);
    expect(s[0].status).toBe("coasting");
    expect(s[0].misses).toBe(1);
    s = mt.scan([{ point: { lat: 10.004, lng: 10 }, t: T0 + 5 * SEC }], T0 + 5 * SEC);
    expect(s).toHaveLength(1);
    expect(s[0].status).toBe("confirmed");
    expect(s[0].misses).toBe(0);
  });

  it("deletes a coasting confirmed track after maxMisses", () => {
    const mt = new MultiTargetTracker({ confirmHits: 1, maxMisses: 2 });
    mt.scan([{ point: { lat: 0, lng: 0 }, t: T0 }], T0);
    expect(mt.scan([], T0 + SEC)).toHaveLength(1);
    expect(mt.scan([], T0 + 2 * SEC)).toHaveLength(1);
    expect(mt.scan([], T0 + 3 * SEC)).toHaveLength(0);
  });

  it("drops tentative tracks faster than confirmed ones", () => {
    const mt = new MultiTargetTracker({ confirmHits: 3, tentativeMaxMisses: 0 });
    mt.scan([{ point: { lat: 0, lng: 0 }, t: T0 }], T0);
    expect(mt.scan([], T0 + SEC)).toHaveLength(0);
  });

  it("does not associate plots outside the gate; spawns a new track instead", () => {
    const mt = new MultiTargetTracker({ confirmHits: 1, gateM: 100 });
    mt.scan([{ point: { lat: 10, lng: 10 }, t: T0 }], T0);
    const s = mt.scan(
      [{ point: { lat: 10.01, lng: 10 }, t: T0 + SEC }],
      T0 + SEC,
    );
    expect(s).toHaveLength(2);
  });

  it("resolves a crossing ambiguity greedily by nearest-first assignment", () => {
    const mt = new MultiTargetTracker({ confirmHits: 1, gateM: 1000 });
    const p1 = { lat: 10, lng: 10 };
    const p2 = { lat: 10.004, lng: 10 };
    let s = mt.scan(
      [
        { point: p1, t: T0 },
        { point: p2, t: T0 },
      ],
      T0,
    );
    const idA = s[0].id;
    const idB = s[1].id;
    s = mt.scan(
      [
        { point: { lat: 10.004, lng: 10 }, t: T0 + SEC },
        { point: { lat: 10, lng: 10 }, t: T0 + SEC },
      ],
      T0 + SEC,
    );
    expect(s).toHaveLength(2);
    const ids = s.map((x) => x.id).sort();
    expect(ids).toEqual([idA, idB].sort());
  });
});
