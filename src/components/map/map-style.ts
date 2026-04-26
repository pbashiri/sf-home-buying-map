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

export const SF_CENTER: [number, number] = [-122.4425, 37.7755];
export const SF_BOUNDS: [[number, number], [number, number]] = [
  [-122.585, 37.665],
  [-122.305, 37.86],
];
