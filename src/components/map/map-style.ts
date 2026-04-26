// MapLibre style construction. Uses MapTiler when NEXT_PUBLIC_MAPTILER_KEY is
// set, OpenFreeMap fallback (free, CC-BY) otherwise.

import type { StyleSpecification } from "maplibre-gl";

export function buildMapStyle(): string | StyleSpecification {
  const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (maptilerKey) {
    return `https://api.maptiler.com/maps/streets-v2/style.json?key=${maptilerKey}`;
  }
  // OpenFreeMap — free vector tiles, CC-BY. "liberty" has more visible
  // terrain & water than "positron" and reads better as a hero map.
  return "https://tiles.openfreemap.org/styles/liberty";
}

export const SF_CENTER: [number, number] = [-122.4448, 37.7749];
export const SF_BOUNDS: [[number, number], [number, number]] = [
  [-122.515, 37.7],
  [-122.355, 37.835],
];
