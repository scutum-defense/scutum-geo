import type { GeoPoint } from "../zones/types";
import { KalmanTracker, type TrackState } from "./kalman";

/**
 * Joint Probabilistic Data Association (JPDA) — soft assignment of plots to
 * tracks in dense clutter. Instead of committing each plot to one track
 * (hard GNN), JPDA computes, for every (plot, track) pair, the posterior
 * probability that the plot originated from the track, marginalized over
 * all feasible joint associations. Each track then updates with a
 * probability-weighted mixture of all plots inside its gate.
 *
 * The feasible-event enumeration is exact for small scan sizes and falls
 * back to per-track marginalization (cheap JPDA) when the joint space is
 * too large, which is standard practice for real-time systems.
 */

export interface JpdaPlot {
  point: GeoPoint;
  t: number;
}

export interface JpdaTrack {
  tracker: KalmanTracker;
}

export interface AssociationWeights {
  /** weights[plotIndex][trackIndex] = P(plot originated from track). */
  weights: number[][];
  /** Per-plot detection probabilities; leftover mass is clutter. */
  clutterMass: number[];
}

export interface JpdaOptions {
  /** Gate in Mahalanobis distance units (squared). */
  gateSigma?: number;
  /** Clutter density per km^2 (used for the null hypothesis weight). */
  clutterDensityPerKm2?: number;
  /** Detection probability. */
  pd?: number;
  /** Max joint events enumerated before falling back to cheap JPDA. */
  maxJointEvents?: number;
}

const DEG_TO_M = 111_320;

function trackLocal(tracker: KalmanTracker, p: GeoPoint, state: TrackState) {
  const dLat = (p.lat - state.lat) * DEG_TO_M;
  const dLng =
    (p.lng - state.lng) * DEG_TO_M * Math.cos((state.lat * Math.PI) / 180);
  return { e: dLat, n: dLng };
}

/**
 * Compute JPDA association weights for one scan.
 * Returns null when no track is initialized (caller should seed tracks).
 */
export function computeAssociationWeights(
  plots: JpdaPlot[],
  tracks: JpdaTrack[],
  options: JpdaOptions = {},
): AssociationWeights {
  const gateSigma2 = options.gateSigma ?? 9;
  const clutterDensity = options.clutterDensityPerKm2 ?? 0.1;
  const pd = options.pd ?? 0.98;
  const maxJointEvents = options.maxJointEvents ?? 20_000;

  const nP = plots.length;
  const nT = tracks.length;
  const weights: number[][] = plots.map(() => tracks.map(() => 0));
  const clutterMass: number[] = plots.map(() => 1);

  if (nP === 0 || nT === 0) return { weights, clutterMass };

  // Likelihood of each (plot, track) pair: Gaussian in Mahalanobis metric.
  const lik: number[][] = [];
  const inGate: boolean[][] = [];
  for (let pi = 0; pi < nP; pi++) {
    lik.push([]);
    inGate.push([]);
    for (let ti = 0; ti < nT; ti++) {
      const tr = tracks[ti].tracker;
      const state = tr.getState();
      const cov = tr.getPositionCovariance();
      if (!state || !cov) {
        lik[pi].push(0);
        inGate[pi].push(false);
        continue;
      }
      const { e, n } = trackLocal(tr, plots[pi].point, state);
      const [c00, c01] = cov[0];
      const [c10, c11] = cov[1];
      const det = c00 * c11 - c01 * c10;
      if (det <= 0) {
        lik[pi].push(0);
        inGate[pi].push(false);
        continue;
      }
      const m2 = (c11 * e * e - (c01 + c10) * e * n + c00 * n * n) / det;
      inGate[pi][ti] = m2 <= gateSigma2;
      if (inGate[pi][ti]) {
        lik[pi][ti] =
          (pd / (2 * Math.PI * Math.sqrt(det))) * Math.exp(-0.5 * m2);
      } else {
        lik[pi][ti] = 0;
      }
    }
  }

  const clutterLik = clutterDensity / 1_000_000;

  // Enumerate joint events: each plot is either clutter (null) or assigned
  // to one track, and each track receives at most one plot per scan.
  let events = 1;
  let feasible = true;
  for (let pi = 0; pi < nP; pi++) {
    const choices = 1 + inGate[pi].filter(Boolean).length;
    events *= choices;
    if (events > maxJointEvents) {
      feasible = false;
      break;
    }
  }

  if (feasible) {
    // Exact enumeration.
    let totalProb = 0;
    const acc: number[][] = plots.map(() => tracks.map(() => 0));
    const clutterAcc: number[] = plots.map(() => 0);
    const assignment: number[] = plots.map(() => -1);

    const enumerate = (pi: number, usedTracks: Set<number>): void => {
      if (pi === nP) {
        let prob = 1;
        for (let k = 0; k < nP; k++) {
          const a = assignment[k];
          prob *= a === -1 ? clutterLik : lik[k][a];
        }
        // Tracks with no plot: missed detection.
        for (let ti = 0; ti < nT; ti++) {
          if (!usedTracks.has(ti)) prob *= 1 - pd;
        }
        totalProb += prob;
        for (let k = 0; k < nP; k++) {
          const a = assignment[k];
          if (a === -1) clutterAcc[k] += prob;
          else acc[k][a] += prob;
        }
        return;
      }
      // Null (clutter) option.
      assignment[pi] = -1;
      enumerate(pi + 1, usedTracks);
      for (let ti = 0; ti < nT; ti++) {
        if (!inGate[pi][ti] || usedTracks.has(ti)) continue;
        assignment[pi] = ti;
        usedTracks.add(ti);
        enumerate(pi + 1, usedTracks);
        usedTracks.delete(ti);
      }
      assignment[pi] = -1;
    };
    enumerate(0, new Set());

    if (totalProb > 0) {
      for (let pi = 0; pi < nP; pi++) {
        for (let ti = 0; ti < nT; ti++) {
          weights[pi][ti] = acc[pi][ti] / totalProb;
        }
        clutterMass[pi] = clutterAcc[pi] / totalProb;
      }
      return { weights, clutterMass };
    }
  }

  // Cheap JPDA fallback: per-track normalization inside gates.
  for (let pi = 0; pi < nP; pi++) {
    let sum = clutterLik;
    for (let ti = 0; ti < nT; ti++) sum += lik[pi][ti];
    if (sum <= 0) continue;
    for (let ti = 0; ti < nT; ti++) {
      weights[pi][ti] = lik[pi][ti] / sum;
    }
    clutterMass[pi] = clutterLik / sum;
  }
  return { weights, clutterMass };
}
