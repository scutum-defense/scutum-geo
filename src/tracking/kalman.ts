import type { GeoPoint } from "../zones/types";
import { destinationPoint } from "../proximity/distance";

export interface TrackState {
  /** Estimated position (deg). */
  lat: number;
  lng: number;
  /** Estimated velocity (m/s), decomposed east/north. */
  vE: number;
  vN: number;
  /** Epoch ms of the state estimate. */
  t: number;
}

export interface KalmanOptions {
  /** Process noise: acceleration spectral density (m²/s³). */
  processNoise?: number;
  /** Measurement noise standard deviation (m). */
  measurementNoise?: number;
}

const DEG_TO_M = 111_320;

/**
 * 2D constant-velocity Kalman filter over geodetic tracks.
 *
 * The filter runs in a local east-north frame measured in meters (ENU),
 * with the state [e, n, vE, vN]. Measurements are converted from lat/lng
 * relative to the track's reference origin, so the Kalman algebra operates
 * on consistent units. This is the standard formulation for radar/ADS-B
 * track smoothing: raw plots jitter, and the filtered track yields stable
 * headings, speeds, and projected positions.
 */
export class KalmanTracker {
  private origin: GeoPoint | null = null;
  /** State: [e, n, vE, vN] in meters and m/s. */
  private s: number[] = [0, 0, 0, 0];
  private P: number[][] = [
    [1e6, 0, 0, 0],
    [0, 1e6, 0, 0],
    [0, 0, 1e4, 0],
    [0, 0, 0, 1e4],
  ];
  private initialized = false;
  private t = 0;
  private readonly q: number;
  private readonly r: number;

  constructor(options: KalmanOptions = {}) {
    this.q = options.processNoise ?? 0.5;
    this.r = options.measurementNoise ?? 25;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private toLocal(point: GeoPoint): { e: number; n: number } {
    const latM = DEG_TO_M;
    const lngM = DEG_TO_M * Math.cos(((this.origin?.lat ?? point.lat) * Math.PI) / 180);
    return {
      e: (point.lng - (this.origin?.lng ?? point.lng)) * lngM,
      n: (point.lat - (this.origin?.lat ?? point.lat)) * latM,
    };
  }

  private toGeo(): TrackState {
    const latM = DEG_TO_M;
    const lngM = DEG_TO_M * Math.cos(((this.origin?.lat ?? 0) * Math.PI) / 180);
    return {
      lat: (this.origin?.lat ?? 0) + this.s[1] / latM,
      lng: (this.origin?.lng ?? 0) + this.s[0] / lngM,
      vE: this.s[2],
      vN: this.s[3],
      t: this.t,
    };
  }

  /** Seed the track with the first observation (velocity unknown). */
  initialize(point: GeoPoint, t: number): void {
    this.origin = { lat: point.lat, lng: point.lng };
    this.s = [0, 0, 0, 0];
    this.P = [
      [this.r * this.r, 0, 0, 0],
      [0, this.r * this.r, 0, 0],
      [0, 0, 1e4, 0],
      [0, 0, 0, 1e4],
    ];
    this.t = t;
    this.initialized = true;
  }

  predict(t: number): TrackState | null {
    if (!this.initialized) return null;
    const dt = (t - this.t) / 1000;
    if (dt <= 0) return this.toGeo();
    this.t = t;

    const F = [
      [1, 0, dt, 0],
      [0, 1, 0, dt],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    this.s = [
      this.s[0] + this.s[2] * dt,
      this.s[1] + this.s[3] * dt,
      this.s[2],
      this.s[3],
    ];
    this.P = matMul(F, matMul(this.P, transpose(F)));

    const q = this.q;
    const Q = [
      [(q * dt * dt * dt) / 3, 0, (q * dt * dt) / 2, 0],
      [0, (q * dt * dt * dt) / 3, 0, (q * dt * dt) / 2],
      [(q * dt * dt) / 2, 0, q * dt, 0],
      [0, (q * dt * dt) / 2, 0, q * dt],
    ];
    this.P = matAdd(this.P, Q);
    return this.toGeo();
  }

  /** Fuse a position observation; returns the updated state. */
  update(point: GeoPoint, t: number): TrackState {
    if (!this.initialized) {
      this.initialize(point, t);
      return this.toGeo();
    }
    this.predict(t);

    const { e, n } = this.toLocal(point);
    const y = [e - this.s[0], n - this.s[1]];

    const H = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
    ];
    const R = [
      [this.r * this.r, 0],
      [0, this.r * this.r],
    ];

    const PHt = matMul(this.P, transpose(H));
    const S = matAdd(matMul(H, PHt), R);
    const K = matMul(PHt, inv2(S));

    this.s = this.s.map((v, i) => v + K[i][0] * y[0] + K[i][1] * y[1]);

    const KH = matMul(K, H);
    const I4 = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    this.P = matMul(matSub(I4, KH), this.P);
    return this.toGeo();
  }

  /** Estimated speed (m/s). */
  speed(): number {
    return Math.hypot(this.s[2], this.s[3]);
  }

  /** Estimated course over ground (deg, 0 = north, clockwise). */
  course(): number {
    if (this.s[2] === 0 && this.s[3] === 0) return 0;
    return (Math.atan2(this.s[2], this.s[3]) * 180) / Math.PI;
  }

  /** Projected position dtMs into the future (great-circle). */
  projected(dtMs: number): GeoPoint | null {
    if (!this.initialized) return null;
    const dt = dtMs / 1000;
    const dist = Math.hypot(this.s[2], this.s[3]) * dt;
    const here = this.toGeo();
    if (dist === 0) return { lat: here.lat, lng: here.lng };
    return destinationPoint(here, dist, this.course());
  }

  getState(): TrackState | null {
    return this.initialized ? this.toGeo() : null;
  }

  /**
   * Position sub-covariance (2x2, ENU meters) of the current estimate.
   * Used by association algorithms to compute Mahalanobis distances.
   */
  getPositionCovariance(): [[number, number], [number, number]] | null {
    if (!this.initialized) return null;
    return [
      [this.P[0][0], this.P[0][1]],
      [this.P[1][0], this.P[1][1]],
    ];
  }
}

function matMul(a: number[][], b: number[][]): number[][] {
  const rows = a.length;
  const cols = b[0].length;
  const inner = b.length;
  const out: number[][] = [];
  for (let i = 0; i < rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < cols; j++) {
      let sum = 0;
      for (let k = 0; k < inner; k++) sum += a[i][k] * b[k][j];
      row.push(sum);
    }
    out.push(row);
  }
  return out;
}

function transpose(a: number[][]): number[][] {
  return a[0].map((_, j) => a.map((row) => row[j]));
}

function matAdd(a: number[][], b: number[][]): number[][] {
  return a.map((row, i) => row.map((v, j) => v + b[i][j]));
}

function matSub(a: number[][], b: number[][]): number[][] {
  return a.map((row, i) => row.map((v, j) => v - b[i][j]));
}

function inv2(m: number[][]): number[][] {
  const det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
  if (Math.abs(det) < 1e-12) {
    return [
      [0, 0],
      [0, 0],
    ];
  }
  const invDet = 1 / det;
  return [
    [m[1][1] * invDet, -m[0][1] * invDet],
    [-m[1][0] * invDet, m[0][0] * invDet],
  ];
}
