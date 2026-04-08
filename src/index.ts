// Zones
export type {
  GeoPoint,
  GeoBoundary,
  ZoneClassification,
  ProtectedZone,
  ZoneViolation,
} from "./zones/types";
export { ZoneClassifier } from "./zones/classifier";

// Corridors
export type { Corridor, CorridorDeviation } from "./corridors/types";
export { CorridorAnalyzer } from "./corridors/analyzer";

// Proximity
export {
  haversineDistance,
  isPointInPolygon,
  distanceToPolygon,
  bearing,
} from "./proximity/distance";
export type { ThreatCorridor } from "./proximity/threat-corridor";
export { projectThreatCorridor } from "./proximity/threat-corridor";

// Projections
export { latLngToMercator, mercatorToLatLng } from "./projections/mercator";
