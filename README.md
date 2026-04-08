```
   ____            _                      ____            
  / ___|  ___ _   _| |_ _   _ _ __ ___   / ___| ___  ___  
  \___ \ / __| | | | __| | | | '_ ` _ \ | |  _ / _ \/ _ \ 
   ___) | (__| |_| | |_| |_| | | | | | || |_| |  __/ (_) |
  |____/ \___|\__,_|\__|\__,_|_| |_| |_| \____|\___|\___/ 
                                                            
  @scutum/geo -- Geospatial Primitives for Defense Infrastructure
```

---

![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)
![Modules](https://img.shields.io/badge/Modules-4-green.svg)
![Status](https://img.shields.io/badge/Status-Alpha-orange.svg)

**Geospatial primitives for defense infrastructure mapping, zone classification, and threat corridor projection.**

Built for sovereign defense platforms that require precise spatial computation -- zone enforcement, corridor monitoring, asset proximity analysis, and real-time threat trajectory projection. Zero external dependencies at runtime. Pure TypeScript. Deterministic results.

---

## Table of Contents

- [Architecture](#architecture)
- [Modules](#modules)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage Examples](#usage-examples)
  - [Zone Classification](#zone-classification)
  - [Corridor Deviation Detection](#corridor-deviation-detection)
  - [Threat Corridor Projection](#threat-corridor-projection)
  - [Distance Computation](#distance-computation)
  - [Mercator Projections](#mercator-projections)
- [API Reference](#api-reference)
  - [Zones Module](#zones-module-api)
  - [Corridors Module](#corridors-module-api)
  - [Proximity Module](#proximity-module-api)
  - [Projections Module](#projections-module-api)
- [Type Reference](#type-reference)
- [Contributing](#contributing)
- [Security](#security)
- [Roadmap](#roadmap)
- [License](#license)

---

## Architecture

```
                    @scutum/geo
    ============================================
    
    +----------------+    +------------------+
    |     Zones      |    |    Corridors     |
    |----------------|    |------------------|
    | ZoneClassifier |    | CorridorAnalyzer |
    | classify()     |    | checkDeviation() |
    | checkViolation |    | loadCorridors()  |
    +-------+--------+    +--------+---------+
            |                      |
            v                      v
    +------------------------------------------+
    |             Proximity                     |
    |-----------------------------------------  |
    | haversineDistance()  | isPointInPolygon() |
    | distanceToPolygon() | bearing()          |
    | projectThreatCorridor()                  |
    +-------------------+----------------------+
                        |
                        v
    +------------------------------------------+
    |            Projections                    |
    |------------------------------------------|
    | latLngToMercator() | mercatorToLatLng()  |
    +------------------------------------------+
```

The library is structured as a layered stack. Higher-level modules (Zones, Corridors) consume lower-level primitives (Proximity, Projections). Each module can also be used independently.

**Data flow for a typical zone violation check:**

```
  GeoPoint (lat/lng)
       |
       v
  ZoneClassifier.classify()
       |
       +---> isPointInPolygon()  (ray-casting algorithm)
       |
       v
  ProtectedZone | null
       |
       v
  ZoneClassifier.checkViolations()
       |
       v
  ZoneViolation[]
```

**Data flow for threat corridor projection:**

```
  Position[] (timestamped lat/lng tracks)
       |
       v
  projectThreatCorridor()
       |
       +---> haversineDistance()  (speed calculation)
       +---> bearing()           (heading calculation)
       |
       v
  ThreatCorridor
       |
       +---> origin (last known position)
       +---> bearing (degrees from true north)
       +---> speedMps (meters per second)
       +---> projectedPath (future positions at 30s intervals)
```

---

## Modules

| Module | Path | Description |
|--------|------|-------------|
| **Zones** | `src/zones/` | Protected zone definitions, point-in-zone classification, and violation detection for restricted and exclusion areas |
| **Corridors** | `src/corridors/` | Maritime, aerial, ground, and pipeline corridor definitions with deviation analysis against defined waypoint paths |
| **Proximity** | `src/proximity/` | Core spatial primitives including haversine distance, point-in-polygon testing, bearing calculation, and threat corridor projection |
| **Projections** | `src/projections/` | Coordinate system transformations including Web Mercator projection for map tile integration |

---

## Installation

```bash
npm install @scutum/geo
```

Or with your preferred package manager:

```bash
pnpm add @scutum/geo
yarn add @scutum/geo
```

### Development Setup

```bash
git clone https://github.com/ScutumDefense/scutum-geo.git
cd scutum-geo
npm install
npm run typecheck
npm test
```

---

## Quick Start

```typescript
import { ZoneClassifier, haversineDistance, bearing } from "@scutum/geo";

// Define a restricted zone around a facility
const classifier = new ZoneClassifier();
classifier.loadZones([
  {
    id: "zone-alpha",
    name: "Alpha Facility Perimeter",
    classification: "restricted",
    boundary: {
      type: "polygon",
      coordinates: [
        { lat: 25.276, lng: 55.296 },
        { lat: 25.280, lng: 55.296 },
        { lat: 25.280, lng: 55.300 },
        { lat: 25.276, lng: 55.300 },
      ],
    },
  },
]);

// Check if a point is inside the restricted zone
const target = { lat: 25.278, lng: 55.298 };
const zone = classifier.classify(target);

if (zone) {
  console.log(`Point is inside: ${zone.name} [${zone.classification}]`);
}

// Calculate distance between two points
const distance = haversineDistance(
  { lat: 25.276, lng: 55.296 },
  { lat: 25.286, lng: 55.306 }
);
console.log(`Distance: ${distance.toFixed(0)} meters`);

// Get bearing between two points
const hdg = bearing(
  { lat: 25.276, lng: 55.296 },
  { lat: 25.286, lng: 55.306 }
);
console.log(`Bearing: ${hdg.toFixed(1)} degrees`);
```

---

## Usage Examples

### Zone Classification

Define protected zones and check whether geographic points fall within them. The classifier uses a ray-casting algorithm for point-in-polygon testing, which handles convex and concave polygons correctly.

```typescript
import { ZoneClassifier } from "@scutum/geo";
import type { ProtectedZone, GeoPoint } from "@scutum/geo";

// Define multiple zones with different classifications
const zones: ProtectedZone[] = [
  {
    id: "exc-001",
    name: "Naval Exclusion Zone",
    classification: "exclusion",
    boundary: {
      type: "polygon",
      coordinates: [
        { lat: 26.100, lng: 56.200 },
        { lat: 26.150, lng: 56.200 },
        { lat: 26.150, lng: 56.260 },
        { lat: 26.100, lng: 56.260 },
      ],
    },
    altitude: { floor: 0, ceiling: 5000 },
    metadata: { authority: "naval-command", established: "2026-01-15" },
  },
  {
    id: "mon-002",
    name: "Coastal Monitoring Area",
    classification: "monitored",
    boundary: {
      type: "polygon",
      coordinates: [
        { lat: 26.050, lng: 56.150 },
        { lat: 26.200, lng: 56.150 },
        { lat: 26.200, lng: 56.350 },
        { lat: 26.050, lng: 56.350 },
      ],
    },
  },
];

const classifier = new ZoneClassifier();
classifier.loadZones(zones);

// Classify a point
const vesselPosition: GeoPoint = { lat: 26.120, lng: 56.230 };
const result = classifier.classify(vesselPosition);

if (result) {
  console.log(`Vessel is in: ${result.name}`);
  console.log(`Classification: ${result.classification}`);
}

// Check for violations (only exclusion and restricted zones trigger violations)
const violations = classifier.checkViolations(
  vesselPosition,
  new Date().toISOString()
);

for (const v of violations) {
  console.log(`VIOLATION: ${v.zoneName} [${v.classification}]`);
  console.log(`  Position: ${v.point.lat}, ${v.point.lng}`);
  console.log(`  Time: ${v.timestamp}`);
}

// Filter zones by classification
const exclusionZones = classifier.getZonesByClassification("exclusion");
console.log(`Total exclusion zones: ${exclusionZones.length}`);
```

### Corridor Deviation Detection

Monitor assets traveling along defined corridors and detect when they deviate beyond acceptable limits.

```typescript
import { CorridorAnalyzer } from "@scutum/geo";
import type { Corridor } from "@scutum/geo";

// Define a maritime shipping corridor
const corridors: Corridor[] = [
  {
    id: "cor-strait-001",
    name: "Strait Transit Corridor",
    type: "maritime",
    waypoints: [
      { lat: 26.000, lng: 56.000 },
      { lat: 26.100, lng: 56.100 },
      { lat: 26.200, lng: 56.200 },
      { lat: 26.300, lng: 56.250 },
      { lat: 26.400, lng: 56.300 },
    ],
    width: 5000, // 5 km corridor width
    metadata: { trafficDirection: "northbound", maxSpeed: 12 },
  },
  {
    id: "cor-pipe-002",
    name: "Subsea Pipeline Route",
    type: "pipeline",
    waypoints: [
      { lat: 25.500, lng: 55.800 },
      { lat: 25.600, lng: 55.900 },
      { lat: 25.700, lng: 56.000 },
    ],
    width: 500, // 500m exclusion zone around pipeline
  },
];

const analyzer = new CorridorAnalyzer();
analyzer.loadCorridors(corridors);

// Check if a vessel has deviated from its corridor
const vesselPos = { lat: 26.150, lng: 56.300 };
const deviations = analyzer.checkDeviation(
  vesselPos,
  new Date().toISOString()
);

for (const dev of deviations) {
  console.log(`DEVIATION: ${dev.corridorName}`);
  console.log(`  Off-track by: ${dev.deviationMeters.toFixed(0)} meters`);
  console.log(`  Nearest waypoint index: ${dev.nearestWaypointIndex}`);
}
```

### Threat Corridor Projection

Project future positions of a tracked entity based on observed trajectory. This is essential for early-warning systems and intercept planning.

```typescript
import { projectThreatCorridor } from "@scutum/geo";

// Observed track positions (timestamped)
const trackPositions = [
  {
    point: { lat: 25.000, lng: 55.000 },
    timestamp: "2026-04-08T10:00:00Z",
  },
  {
    point: { lat: 25.010, lng: 55.010 },
    timestamp: "2026-04-08T10:01:00Z",
  },
];

// Project 5 minutes into the future (300 seconds)
const threat = projectThreatCorridor(trackPositions, 300);

if (threat) {
  console.log(`Origin: ${threat.origin.lat}, ${threat.origin.lng}`);
  console.log(`Bearing: ${threat.bearing.toFixed(1)} degrees`);
  console.log(`Speed: ${threat.speedMps.toFixed(1)} m/s`);
  console.log(`Projected positions (30s intervals):`);

  for (const pos of threat.projectedPath) {
    console.log(`  ${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`);
  }
}
```

### Distance Computation

The Haversine formula provides accurate great-circle distance between two points on Earth's surface.

```typescript
import { haversineDistance, bearing, isPointInPolygon } from "@scutum/geo";

// Distance between Abu Dhabi and Dubai
const abuDhabi = { lat: 24.4539, lng: 54.3773 };
const dubai = { lat: 25.2048, lng: 55.2708 };

const distanceMeters = haversineDistance(abuDhabi, dubai);
console.log(`Distance: ${(distanceMeters / 1000).toFixed(1)} km`);

// Bearing from Abu Dhabi to Dubai
const hdg = bearing(abuDhabi, dubai);
console.log(`Bearing: ${hdg.toFixed(1)} degrees`);

// Check if a point is inside a polygon
const polygon = [
  { lat: 24.0, lng: 54.0 },
  { lat: 26.0, lng: 54.0 },
  { lat: 26.0, lng: 56.0 },
  { lat: 24.0, lng: 56.0 },
];

const testPoint = { lat: 25.0, lng: 55.0 };
const inside = isPointInPolygon(testPoint, polygon);
console.log(`Point inside polygon: ${inside}`);
```

### Mercator Projections

Convert between geographic coordinates (lat/lng) and Web Mercator tile coordinates for map rendering and spatial indexing.

```typescript
import { latLngToMercator, mercatorToLatLng } from "@scutum/geo";

// Convert geographic coordinates to Mercator
const mercator = latLngToMercator(25.2048, 55.2708);
console.log(`Mercator: x=${mercator.x.toFixed(6)}, y=${mercator.y.toFixed(6)}`);

// Convert back to geographic coordinates
const geo = mercatorToLatLng(mercator.x, mercator.y);
console.log(`Geographic: lat=${geo.lat.toFixed(4)}, lng=${geo.lng.toFixed(4)}`);
```

---

## API Reference

### Zones Module API

#### `ZoneClassifier`

The primary class for zone management and point classification.

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `loadZones` | `zones: ProtectedZone[]` | `void` | Load zone definitions into the classifier. Replaces any previously loaded zones. |
| `classify` | `point: GeoPoint` | `ProtectedZone \| null` | Returns the first zone containing the given point, or null if the point is not in any zone. |
| `checkViolations` | `point: GeoPoint, timestamp: string` | `ZoneViolation[]` | Checks if the point is inside any exclusion or restricted zone and returns all violations. |
| `getZonesByClassification` | `classification: string` | `ProtectedZone[]` | Filter loaded zones by their classification type. |

#### Zone Classification Types

| Classification | Description | Violation Trigger |
|---------------|-------------|-------------------|
| `restricted` | Access requires authorization | Yes |
| `controlled` | Access is regulated | No |
| `monitored` | Under active surveillance | No |
| `exclusion` | No access permitted | Yes |
| `buffer` | Transition zone around protected areas | No |
| `corridor` | Defined transit path | No |

### Corridors Module API

#### `CorridorAnalyzer`

Manages corridor definitions and detects deviations from defined paths.

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `loadCorridors` | `corridors: Corridor[]` | `void` | Load corridor definitions. Replaces any previously loaded corridors. |
| `checkDeviation` | `point: GeoPoint, timestamp: string` | `CorridorDeviation[]` | Check if the point has deviated from any loaded corridor beyond its defined width. |

#### Corridor Types

| Type | Description |
|------|-------------|
| `maritime` | Sea-based shipping lanes and naval transit routes |
| `aerial` | Air corridors, flight paths, and restricted airspace boundaries |
| `ground` | Land-based convoy routes, border patrol paths |
| `pipeline` | Subsea or overland pipeline routes with exclusion buffers |

### Proximity Module API

#### Distance Functions

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `haversineDistance` | `a: GeoPoint, b: GeoPoint` | `number` | Great-circle distance in meters between two points using the Haversine formula. Accuracy is within 0.5% for most practical distances. |
| `isPointInPolygon` | `point: GeoPoint, polygon: GeoPoint[]` | `boolean` | Ray-casting algorithm to determine if a point lies inside a polygon. Works with convex and concave polygons. |
| `distanceToPolygon` | `point: GeoPoint, polygon: GeoPoint[]` | `number` | Minimum distance in meters from a point to any vertex of the polygon. Note: this is an approximation based on vertex distances. |
| `bearing` | `from: GeoPoint, to: GeoPoint` | `number` | Initial bearing in degrees (0-360) from one point to another along a great-circle path. 0 = North, 90 = East, 180 = South, 270 = West. |

#### Threat Corridor Function

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `projectThreatCorridor` | `positions: {point, timestamp}[], projectionSeconds?: number` | `ThreatCorridor \| null` | Projects a future trajectory based on the last two observed positions. Returns null if fewer than 2 positions are provided or if the time delta is non-positive. Default projection is 300 seconds (5 minutes) with positions computed at 30-second intervals. |

#### ThreatCorridor Interface

| Field | Type | Description |
|-------|------|-------------|
| `origin` | `GeoPoint` | The last observed position |
| `bearing` | `number` | Heading in degrees from true north |
| `speedMps` | `number` | Computed speed in meters per second |
| `projectedPath` | `GeoPoint[]` | Array of projected future positions |
| `affectedZoneIds` | `string[]` | IDs of zones in the projected path (for integration with ZoneClassifier) |
| `timeToImpactSeconds` | `number` | Estimated time to reach a target (0 if no target specified) |

### Projections Module API

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `latLngToMercator` | `lat: number, lng: number` | `{ x: number, y: number }` | Converts geographic coordinates to Web Mercator (EPSG:3857) normalized tile coordinates. Output x and y are in the range [0, 1]. |
| `mercatorToLatLng` | `x: number, y: number` | `{ lat: number, lng: number }` | Converts Web Mercator normalized tile coordinates back to geographic coordinates. |

---

## Type Reference

### GeoPoint

```typescript
interface GeoPoint {
  lat: number;   // Latitude in decimal degrees (-90 to 90)
  lng: number;   // Longitude in decimal degrees (-180 to 180)
  alt?: number;  // Optional altitude in meters above sea level
}
```

### GeoBoundary

```typescript
interface GeoBoundary {
  type: "polygon";
  coordinates: GeoPoint[];  // Ordered vertices (no need to close the ring)
}
```

### ProtectedZone

```typescript
interface ProtectedZone {
  id: string;
  name: string;
  classification: ZoneClassification;
  boundary: GeoBoundary;
  altitude?: { floor: number; ceiling: number };
  metadata?: Record<string, unknown>;
}
```

### ZoneViolation

```typescript
interface ZoneViolation {
  zoneId: string;
  zoneName: string;
  classification: ZoneClassification;
  point: GeoPoint;
  distance: number;
  timestamp: string;  // ISO 8601
}
```

### Corridor

```typescript
interface Corridor {
  id: string;
  name: string;
  type: "maritime" | "aerial" | "ground" | "pipeline";
  waypoints: GeoPoint[];
  width: number;  // meters
  metadata?: Record<string, unknown>;
}
```

### CorridorDeviation

```typescript
interface CorridorDeviation {
  corridorId: string;
  corridorName: string;
  point: GeoPoint;
  deviationMeters: number;
  nearestWaypointIndex: number;
  timestamp: string;  // ISO 8601
}
```

---

## Design Decisions

### Why Ray-Casting for Point-in-Polygon?

The ray-casting algorithm was chosen for `isPointInPolygon` because it:

1. Handles both convex and concave polygons correctly
2. Has O(n) complexity where n is the number of polygon edges
3. Is numerically stable for the precision levels used in geographic coordinates
4. Does not require polygon pre-processing or spatial indexing

For production use cases with thousands of zones, consider wrapping the classifier with a spatial index (R-tree or grid-based) to reduce the number of polygon checks per query.

### Why Haversine Over Vincenty?

The Haversine formula provides sufficient accuracy (within 0.5%) for defense operational distances while being computationally simpler than the Vincenty formulae. For distances under 1000 km, the error is negligible for all practical purposes. The library may add Vincenty as an optional higher-precision alternative in a future release.

### Coordinate Convention

All coordinates use decimal degrees with WGS84 datum. Latitude ranges from -90 (South Pole) to 90 (North Pole). Longitude ranges from -180 (West) to 180 (East). This matches the convention used by GPS receivers, most mapping APIs, and GeoJSON.

---

<details>
<summary><strong>Contributing</strong></summary>

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Write tests for your changes
4. Ensure all tests pass: `npm test`
5. Ensure type checking passes: `npm run typecheck`
6. Submit a pull request

### Code Standards

- All source files must be TypeScript with strict mode enabled
- All public functions must have JSDoc documentation
- All new features must have corresponding test coverage
- No runtime dependencies are permitted
- All coordinates must use the WGS84 datum and decimal degree format

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check only
npm run typecheck
```

### Pull Request Guidelines

- PRs must target the `main` branch
- All CI checks must pass before merge
- At least one approval from a CODEOWNERS team member is required
- Commit messages must follow Conventional Commits format

</details>

<details>
<summary><strong>Security</strong></summary>

### Reporting Vulnerabilities

If you discover a security vulnerability in this library, please report it responsibly:

1. Do NOT open a public GitHub issue
2. Email security@scutumdefense.com with details
3. Include steps to reproduce the vulnerability
4. We will acknowledge receipt within 24 hours
5. We will provide a fix timeline within 72 hours

### Security Considerations

- This library performs pure computation and does not make network requests
- No user data is stored, logged, or transmitted
- All inputs are validated for type correctness at the TypeScript level
- The library does not use dynamic code execution, dynamic imports, or reflection
- No cryptographic operations are performed (see `@scutum/audit-chain` for that)

### Threat Model

The library assumes:
- Input coordinates are provided by trusted upstream systems
- Zone and corridor definitions are loaded from authenticated configuration sources
- The calling application handles access control and authentication
- Violation results are consumed by authorized systems only

</details>

<details>
<summary><strong>Roadmap</strong></summary>

### v0.2.0 (Planned)

- [ ] Spatial indexing (R-tree) for zone classification performance
- [ ] Vincenty distance formula as a high-precision alternative
- [ ] GeoJSON import/export for zone and corridor definitions
- [ ] Polygon simplification utilities
- [ ] Multi-altitude zone classification (3D)

### v0.3.0 (Planned)

- [ ] Corridor segment interpolation (point-to-segment distance)
- [ ] Historical track analysis with deviation statistics
- [ ] Threat corridor intersection with zone boundaries
- [ ] Batch zone classification for large datasets
- [ ] Time-windowed violation aggregation

### v1.0.0 (Target)

- [ ] Stable public API with semantic versioning guarantees
- [ ] Comprehensive benchmark suite
- [ ] WASM compilation target for edge deployment
- [ ] Integration guides for common GIS platforms
- [ ] Full documentation site

</details>

---

## Performance Notes

| Operation | Complexity | Typical Latency |
|-----------|-----------|-----------------|
| `haversineDistance` | O(1) | < 1 microsecond |
| `isPointInPolygon` | O(n) per polygon | < 10 microseconds for 100-vertex polygons |
| `classify` (ZoneClassifier) | O(z * n) | Depends on zone count (z) and vertices (n) |
| `checkDeviation` (CorridorAnalyzer) | O(c * w) | Depends on corridor count (c) and waypoints (w) |
| `projectThreatCorridor` | O(t) | Linear in projection time steps |
| `latLngToMercator` | O(1) | < 1 microsecond |

For high-throughput applications processing thousands of points per second, consider:
- Pre-filtering with bounding box checks before polygon tests
- Using spatial indexing for zone lookups
- Batching corridor checks with shared nearest-waypoint caching

---

## License

```
Copyright 2026 Scutum Defense

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

---

Built by [Scutum Defense](https://scutumdefense.com) -- Sovereign defense infrastructure for the Gulf region.
