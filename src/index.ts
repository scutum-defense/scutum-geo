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
export { MultiTargetTracker } from "./tracking/multi-target";
export type { MultiTargetOptions, MultiTrackState, Plot, TrackStatus } from "./tracking/multi-target";
export { computeAssociationWeights } from "./tracking/jpda";
export type { AssociationWeights, JpdaOptions, JpdaPlot, JpdaTrack } from "./tracking/jpda";
export { PersistentJpdaTracker } from "./tracking/persistent-jpda";
export type { JpdaTrackState, PersistentJpdaOptions } from "./tracking/persistent-jpda";
export { KalmanTracker } from "./tracking/kalman";
