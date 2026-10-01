import type { GeoPoint } from "../zones/types";

const EARTH_RADIUS_M = 6371000;

export function haversineDistance(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function isPointInPolygon(point: GeoPoint, polygon: GeoPoint[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    if ((yi > point.lat) !== (yj > point.lat) && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function destinationPoint(from: GeoPoint, bearingDeg: number, distanceM: number): GeoPoint {
  const delta = distanceM / EARTH_RADIUS_M;
  const theta = toRad(bearingDeg);
  const lat1 = toRad(from.lat);
  const lng1 = toRad(from.lng);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(delta) + Math.cos(lat1) * Math.sin(delta) * Math.cos(theta)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(lat1),
      Math.cos(delta) - Math.sin(lat1) * Math.sin(lat2)
    );
  return { lat: toDeg(lat2), lng: ((toDeg(lng2) + 540) % 360) - 180 };
}

export function crossTrackDistance(point: GeoPoint, a: GeoPoint, b: GeoPoint): number {
  const d13 = haversineDistance(a, point) / EARTH_RADIUS_M;
  if (d13 === 0) return 0;
  const theta13 = toRad(bearing(a, point));
  const theta12 = toRad(bearing(a, b));
  const dxt = Math.asin(Math.sin(d13) * Math.sin(theta13 - theta12)) * EARTH_RADIUS_M;
  return dxt;
}

export function distanceToSegment(point: GeoPoint, a: GeoPoint, b: GeoPoint): number {
  if (haversineDistance(a, b) === 0) return haversineDistance(point, a);
  const dA = haversineDistance(point, a);
  const dB = haversineDistance(point, b);
  const withinFromA = Math.abs(bearing(a, point) - bearing(a, b)) <= 90;
  const withinFromB = Math.abs(bearing(b, a) - bearing(b, point)) <= 90;
  if (withinFromA && withinFromB) return Math.abs(crossTrackDistance(point, a, b));
  return Math.min(dA, dB);
}

export function distanceToPolygon(point: GeoPoint, polygon: GeoPoint[]): number {
  if (polygon.length === 0) return Infinity;
  if (polygon.length < 3 || isPointInPolygon(point, polygon)) return 0;
  let minDist = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const dist = distanceToSegment(point, polygon[j], polygon[i]);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

export function bearing(from: GeoPoint, to: GeoPoint): number {
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(to.lat));
  const x = Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) - Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function toRad(deg: number): number { return (deg * Math.PI) / 180; }
function toDeg(rad: number): number { return (rad * 180) / Math.PI; }
