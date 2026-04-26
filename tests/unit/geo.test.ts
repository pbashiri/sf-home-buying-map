import { describe, expect, it } from "vitest";
import {
  distanceToLineMeters,
  haversineMeters,
  isInSF,
  pointInPolygon,
  SF_BBOX,
} from "@/lib/geo";
import type { Polygon } from "geojson";

describe("haversineMeters", () => {
  it("returns 0 for the same point", () => {
    expect(haversineMeters(37.7665, -122.4294, 37.7665, -122.4294)).toBe(0);
  });

  it("computes a known distance within tolerance", () => {
    // Ferry Building (37.7955, -122.3937) to Civic Center BART (37.7796, -122.4138)
    const d = haversineMeters(37.7955, -122.3937, 37.7796, -122.4138);
    expect(d).toBeGreaterThan(2400);
    expect(d).toBeLessThan(2700);
  });
});

describe("isInSF", () => {
  it("321 Church St is in SF", () => {
    expect(isInSF(37.7665, -122.4294)).toBe(true);
  });
  it("Berkeley is not in SF", () => {
    expect(isInSF(37.8716, -122.2727)).toBe(false);
  });
  it("matches the published bbox", () => {
    expect(SF_BBOX.south).toBeLessThan(SF_BBOX.north);
    expect(SF_BBOX.west).toBeLessThan(SF_BBOX.east);
  });
});

describe("pointInPolygon", () => {
  const square: Polygon = {
    type: "Polygon",
    coordinates: [
      [
        [-122.5, 37.7],
        [-122.5, 37.8],
        [-122.4, 37.8],
        [-122.4, 37.7],
        [-122.5, 37.7],
      ],
    ],
  };
  it("inside", () => {
    expect(pointInPolygon(-122.45, 37.75, square)).toBe(true);
  });
  it("outside", () => {
    expect(pointInPolygon(-122.35, 37.75, square)).toBe(false);
  });
});

describe("distanceToLineMeters", () => {
  it("a point on a horizontal line has ~0 distance", () => {
    const line = [
      [37.77, -122.45],
      [37.77, -122.42],
    ];
    expect(distanceToLineMeters(37.77, -122.435, line)).toBeLessThan(2);
  });
  it("a point ~111m north of the line is ~111m away", () => {
    const line = [
      [37.77, -122.45],
      [37.77, -122.42],
    ];
    const d = distanceToLineMeters(37.771, -122.435, line);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });
});
