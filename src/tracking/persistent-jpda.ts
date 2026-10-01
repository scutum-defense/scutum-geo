import type { GeoPoint } from "../zones/types";
import { KalmanTracker, type TrackState } from "./kalman";
import { computeAssociationWeights, type JpdaOptions } from "./jpda";

/**
 * Persistent JPDA tracker: consumes association weights scan-over-scan and
 * maintains a living track table. Each scan:
 *   1. every track predicts forward,
 *   2. JPDA weights are computed against the predictions,
 *   3. each track fuses ALL its gated plots weighted by association
 *      probability (PDA update), not just the single best one,
 *   4. plots dominated by clutter mass above the threshold spawn new
 *      tentative tracks,
 *   5. tracks with no associated mass coast and are culled by a miss budget.
 */

export interface JpdaTrackState {
  id: number;
  status: "tentative" | "confirmed" | "coasting";
  hits: number;
  misses: number;
  /** Total association mass received in the last scan (0..n). */
  lastAssociationMass: number;
  state?: TrackState;
}

export interface PersistentJpdaOptions extends JpdaOptions {
  confirmMass?: number;
  maxMisses?: number;
  /** Clutter probability above which a plot may spawn a new track. */
  spawnClutterThreshold?: number;
}

interface Track {
  id: number;
  tracker: KalmanTracker;
  status: JpdaTrackState["status"];
  hits: number;
  misses: number;
  lastMass: number;
}

export class PersistentJpdaTracker {
  private tracks: Track[] = [];
  private nextId = 1;
  private readonly confirmMass: number;
  private readonly maxMisses: number;
  private readonly spawnClutterThreshold: number;
  private readonly jpdaOptions: JpdaOptions;

  constructor(options: PersistentJpdaOptions = {}) {
    this.confirmMass = options.confirmMass ?? 0.6;
    this.maxMisses = options.maxMisses ?? 3;
    this.spawnClutterThreshold = options.spawnClutterThreshold ?? 0.5;
    this.jpdaOptions = options;
  }

  scan(plots: { point: GeoPoint; t: number }[], t: number): JpdaTrackState[] {
    // Predict all tracks to scan time.
    for (const tr of this.tracks) {
      tr.tracker.predict(t);
    }

    if (plots.length > 0 && this.tracks.length > 0) {
      const { weights, clutterMass } = computeAssociationWeights(
        plots,
        this.tracks.map((tr) => ({ tracker: tr.tracker })),
        this.jpdaOptions,
      );

      // PDA update: fuse all gated plots weighted by beta.
      this.tracks.forEach((tr, ti) => {
        let mass = 0;
        plots.forEach((plot, pi) => {
          const beta = weights[pi][ti];
          if (beta > 0.01) {
            tr.tracker.updateWeighted(plot.point, t, beta);
            mass += beta;
          }
        });
        tr.lastMass = mass;
        if (mass >= this.confirmMass) {
          tr.hits += 1;
          tr.misses = 0;
          tr.status = "confirmed";
        } else if (mass > 0) {
          tr.hits += 1;
          tr.misses = 0;
          tr.status = tr.status === "confirmed" ? "confirmed" : "tentative";
        } else {
          tr.misses += 1;
          tr.status = "coasting";
        }
      });

      // Spawn new tracks from plots dominated by clutter.
      plots.forEach((plot, pi) => {
        if (clutterMass[pi] >= this.spawnClutterThreshold) {
          const tracker = new KalmanTracker();
          tracker.initialize(plot.point, t);
          this.tracks.push({
            id: this.nextId++,
            tracker,
            status: "tentative",
            hits: 1,
            misses: 0,
            lastMass: 0,
          });
        }
      });
    } else if (this.tracks.length > 0) {
      for (const tr of this.tracks) {
        tr.misses += 1;
        tr.status = "coasting";
        tr.lastMass = 0;
      }
    } else if (plots.length > 0) {
      for (const plot of plots) {
        const tracker = new KalmanTracker();
        tracker.initialize(plot.point, t);
        this.tracks.push({
          id: this.nextId++,
          tracker,
          status: "tentative",
          hits: 1,
          misses: 0,
          lastMass: 0,
        });
      }
    }

    this.tracks = this.tracks.filter((tr) => tr.misses <= this.maxMisses);
    return this.snapshot();
  }

  snapshot(): JpdaTrackState[] {
    return this.tracks.map((tr) => ({
      id: tr.id,
      status: tr.status,
      hits: tr.hits,
      misses: tr.misses,
      lastAssociationMass: tr.lastMass,
      state: tr.tracker.getState() ?? undefined,
    }));
  }
}
