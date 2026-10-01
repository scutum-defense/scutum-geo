import type { GeoPoint } from "../zones/types";
import { KalmanTracker, type TrackState } from "./kalman";

export type TrackStatus = "tentative" | "confirmed" | "coasting";

export interface Plot {
  point: GeoPoint;
  /** Epoch ms. */
  t: number;
}

export interface MultiTrackState {
  id: number;
  status: TrackStatus;
  /** Number of updates since the track was created. */
  hits: number;
  /** Number of consecutive scans without an associated plot. */
  misses: number;
  /** Current filtered state; present once initialized. */
  state?: TrackState;
}

export interface MultiTargetOptions {
  /** Distance gate (m) for plot-track association. */
  gateM?: number;
  /** Hits required before a tentative track is confirmed. */
  confirmHits?: number;
  /** Consecutive misses before a confirmed track is deleted. */
  maxMisses?: number;
  /** Misses before a tentative track is dropped. */
  tentativeMaxMisses?: number;
  processNoise?: number;
  measurementNoise?: number;
}

interface InternalTrack {
  id: number;
  tracker: KalmanTracker;
  status: TrackStatus;
  hits: number;
  misses: number;
}

/**
 * Multi-target tracker: global nearest-neighbor (GNN) data association with
 * a Mahalanobis-style gate, plus a full track lifecycle. Each scan, every
 * plot is scored against every live track's predicted position; the
 * best-first greedy assignment pairs plots to tracks one at a time so no
 * plot or track is used twice. Unassigned plots spawn tentative tracks;
 * unmatched tracks coast on predictions and are deleted after a miss budget.
 */
export class MultiTargetTracker {
  private tracks: InternalTrack[] = [];
  private nextId = 1;
  private readonly gateM: number;
  private readonly confirmHits: number;
  private readonly maxMisses: number;
  private readonly tentativeMaxMisses: number;
  private readonly kalmanOpts: { processNoise?: number; measurementNoise?: number };

  constructor(options: MultiTargetOptions = {}) {
    this.gateM = options.gateM ?? 300;
    this.confirmHits = options.confirmHits ?? 2;
    this.maxMisses = options.maxMisses ?? 3;
    this.tentativeMaxMisses = options.tentativeMaxMisses ?? 1;
    this.kalmanOpts = {
      processNoise: options.processNoise,
      measurementNoise: options.measurementNoise,
    };
  }

  /** Process one scan of plots. Returns the track table after the update. */
  scan(plots: Plot[], t: number): MultiTrackState[] {
    const live = this.tracks.filter((tr) => tr.status !== "coasting" || tr.misses <= this.maxMisses);
    this.tracks = live;

    // Predict every track forward to scan time.
    for (const tr of this.tracks) {
      if (tr.tracker.isInitialized()) {
        tr.tracker.predict(t);
      }
    }

    // Score all (plot, track) pairs inside the gate.
    interface Pair {
      plotIdx: number;
      trackIdx: number;
      dist: number;
    }
    const pairs: Pair[] = [];
    const states = this.tracks.map((tr) =>
      tr.tracker.isInitialized() ? tr.tracker.getState() : null,
    );
    plots.forEach((plot, pi) => {
      this.tracks.forEach((tr, ti) => {
        const st = states[ti];
        if (!st) return;
        const d = distanceMeters(st, plot.point);
        if (d <= this.gateM) pairs.push({ plotIdx: pi, trackIdx: ti, dist: d });
      });
    });
    pairs.sort((a, b) => a.dist - b.dist);

    const usedPlots = new Set<number>();
    const usedTracks = new Set<number>();
    for (const p of pairs) {
      if (usedPlots.has(p.plotIdx) || usedTracks.has(p.trackIdx)) continue;
      usedPlots.add(p.plotIdx);
      usedTracks.add(p.trackIdx);
      const tr = this.tracks[p.trackIdx];
      tr.tracker.update(plots[p.plotIdx].point, t);
      tr.hits += 1;
      tr.misses = 0;
      if (tr.status === "tentative" && tr.hits >= this.confirmHits) {
        tr.status = "confirmed";
      }
      tr.status = tr.status === "tentative" ? "tentative" : "confirmed";
    }

    // Unmatched tracks coast.
    this.tracks.forEach((tr, ti) => {
      if (usedTracks.has(ti)) return;
      tr.misses += 1;
      tr.status = "coasting";
    });

    // Unassigned plots spawn tentative tracks.
    plots.forEach((_, pi) => {
      if (usedPlots.has(pi)) return;
      const tracker = new KalmanTracker(this.kalmanOpts);
      tracker.initialize(plots[pi].point, t);
      this.tracks.push({
        id: this.nextId++,
        tracker,
        status: "tentative",
        hits: 1,
        misses: 0,
      });
    });

    // Cull dead tracks.
    this.tracks = this.tracks.filter(
      (tr) =>
        tr.status !== "coasting" ||
        tr.misses <= (tr.hits >= this.confirmHits ? this.maxMisses : this.tentativeMaxMisses),
    );

    return this.snapshot();
  }

  snapshot(): MultiTrackState[] {
    return this.tracks.map((tr) => ({
      id: tr.id,
      status: tr.status,
      hits: tr.hits,
      misses: tr.misses,
      state: tr.tracker.isInitialized() ? tr.tracker.getState() ?? undefined : undefined,
    }));
  }
}

function distanceMeters(st: TrackState, p: GeoPoint): number {
  const DEG_TO_M = 111_320;
  const dLat = (p.lat - st.lat) * DEG_TO_M;
  const dLng =
    (p.lng - st.lng) * DEG_TO_M * Math.cos((st.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}
