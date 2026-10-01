// Zones
export type {
  GeoPoint,
  GeoBoundary,
  ZoneClassification,
  ProtectedZone,
  ZoneViolation,
} from "./zones/types";
export { ZoneClassifier } from "./zones/classifier";
export { ZoneIndex } from "./zones/zone-index";
export { KalmanTracker } from "./tracking/kalman";
export type { TrackState, KalmanOptions } from "./tracking/kalman";

// Corridors
export type { Corridor, CorridorDeviation } from "./corridors/types";
export { CorridorAnalyzer } from "./corridors/analyzer";

// Proximity
export {
  haversineDistance,
  isPointInPolygon,
  distanceToPolygon,
  distanceToSegment,
  crossTrackDistance,
  destinationPoint,
  bearing,
} from "./proximity/distance";
export type { ThreatCorridor } from "./proximity/threat-corridor";
export { projectThreatCorridor } from "./proximity/threat-corridor";

// Projections
export { latLngToMercator, mercatorToLatLng } from "./projections/mercator";
