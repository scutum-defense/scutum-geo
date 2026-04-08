import { ZoneClassifier } from "../src/zones/classifier";
import { CorridorAnalyzer } from "../src/corridors/analyzer";
import { haversineDistance, bearing } from "../src/proximity/distance";
import { projectThreatCorridor } from "../src/proximity/threat-corridor";
import type { ProtectedZone } from "../src/zones/types";

// Define protected zones around Abu Dhabi port infrastructure
const zones: ProtectedZone[] = [
  {
    id: "zone-fuel-01",
    name: "Fuel Storage Exclusion Zone",
    classification: "exclusion",
    boundary: {
      type: "polygon",
      coordinates: [
        { lat: 24.450, lng: 54.370 },
        { lat: 24.450, lng: 54.390 },
        { lat: 24.470, lng: 54.390 },
        { lat: 24.470, lng: 54.370 },
      ],
    },
  },
  {
    id: "zone-perimeter-01",
    name: "Port Perimeter Buffer",
    classification: "restricted",
    boundary: {
      type: "polygon",
      coordinates: [
        { lat: 24.440, lng: 54.360 },
        { lat: 24.440, lng: 54.400 },
        { lat: 24.480, lng: 54.400 },
        { lat: 24.480, lng: 54.360 },
      ],
    },
  },
];

// Check a drone position against zones
const classifier = new ZoneClassifier();
classifier.loadZones(zones);

const dronePosition = { lat: 24.460, lng: 54.380 };
const zone = classifier.classify(dronePosition);

if (zone) {
  console.log(`Drone is inside: ${zone.name} (${zone.classification})`);
}

const violations = classifier.checkViolations(dronePosition, new Date().toISOString());
for (const v of violations) {
  console.log(`VIOLATION: ${v.zoneName} (${v.classification})`);
}

// Project threat corridor from drone track
const track = [
  { point: { lat: 24.440, lng: 54.370 }, timestamp: "2026-04-01T08:00:00Z" },
  { point: { lat: 24.450, lng: 54.375 }, timestamp: "2026-04-01T08:01:00Z" },
];

const corridor = projectThreatCorridor(track, 300);
if (corridor) {
  console.log(`Threat bearing: ${corridor.bearing.toFixed(1)} degrees`);
  console.log(`Speed: ${corridor.speedMps.toFixed(1)} m/s`);
  console.log(`Projected path points: ${corridor.projectedPath.length}`);
}
