// Pure geometry helpers. No deps on the rest of the app.
// All distances are in meters unless stated otherwise.

import type { Feature, FeatureCollection, LineString, MultiPolygon, Point, Polygon, Position } from "geojson";

const R_EARTH_M = 6_371_008.8;

export function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_M * Math.asin(Math.sqrt(a));
}

// Robust point-in-ring (ray casting). Position is [lng, lat].
function pointInRing(pt: Position, ring: Position[]): boolean {
  const [x, y] = [pt[0]!, pt[1]!];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!;
    const yi = ring[i]![1]!;
    const xj = ring[j]![0]!;
    const yj = ring[j]![1]!;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(lng: number, lat: number, polygon: Polygon | MultiPolygon): boolean {
  const pt: Position = [lng, lat];
  if (polygon.type === "Polygon") {
    const [outer, ...holes] = polygon.coordinates;
    if (!outer || !pointInRing(pt, outer)) return false;
    return !holes.some((h) => pointInRing(pt, h));
  }
  for (const poly of polygon.coordinates) {
    const [outer, ...holes] = poly;
    if (!outer) continue;
    if (pointInRing(pt, outer) && !holes.some((h) => pointInRing(pt, h))) return true;
  }
  return false;
}

// Distance from point to line segment in meters using local-tangent equirectangular projection.
function distanceToSegmentMeters(
  lat: number,
  lng: number,
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const refLat = toRad((lat + lat1 + lat2) / 3);
  const cosLat = Math.cos(refLat);
  const x = toRad(lng) * R_EARTH_M * cosLat;
  const y = toRad(lat) * R_EARTH_M;
  const x1 = toRad(lng1) * R_EARTH_M * cosLat;
  const y1 = toRad(lat1) * R_EARTH_M;
  const x2 = toRad(lng2) * R_EARTH_M * cosLat;
  const y2 = toRad(lat2) * R_EARTH_M;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(x - x1, y - y1);
  let t = ((x - x1) * dx + (y - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return Math.hypot(x - px, y - py);
}

export function distanceToLineMeters(lat: number, lng: number, line: number[][]): number {
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    // Convention: caller passes [lat, lng] pairs.
    const d = distanceToSegmentMeters(lat, lng, a[0]!, a[1]!, b[0]!, b[1]!);
    if (d < min) min = d;
  }
  return min;
}

export function distanceToLineStringMeters(lat: number, lng: number, geom: LineString): number {
  // GeoJSON: [lng, lat]
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i + 1 < geom.coordinates.length; i++) {
    const a = geom.coordinates[i]!;
    const b = geom.coordinates[i + 1]!;
    const d = distanceToSegmentMeters(lat, lng, a[1]!, a[0]!, b[1]!, b[0]!);
    if (d < min) min = d;
  }
  return min;
}

// Stable polygon containment over a FeatureCollection.
export function findContainingFeatures<P extends object>(
  lng: number,
  lat: number,
  fc: FeatureCollection<Polygon | MultiPolygon, P>,
): Feature<Polygon | MultiPolygon, P>[] {
  const hits: Feature<Polygon | MultiPolygon, P>[] = [];
  for (const f of fc.features) {
    if (pointInPolygon(lng, lat, f.geometry)) hits.push(f);
  }
  return hits;
}

// SF bounding box (rough land + Treasure Island, excludes Farallons).
export const SF_BBOX = {
  west: -122.515,
  south: 37.7,
  east: -122.355,
  north: 37.835,
} as const;

export function isInSF(lat: number, lng: number): boolean {
  return lat >= SF_BBOX.south && lat <= SF_BBOX.north && lng >= SF_BBOX.west && lng <= SF_BBOX.east;
}

// Find nearest point in a list. Returns the entry plus distance in meters.
export function nearest<T extends { lat: number; lng: number }>(
  lat: number,
  lng: number,
  pts: T[],
): { item: T; dist: number } | null {
  if (pts.length === 0) return null;
  let best: { item: T; dist: number } | null = null;
  for (const p of pts) {
    const d = haversineMeters(lat, lng, p.lat, p.lng);
    if (!best || d < best.dist) best = { item: p, dist: d };
  }
  return best;
}
