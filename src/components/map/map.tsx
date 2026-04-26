"use client";

import maplibregl, { type Map as MapLibreMap, type StyleSpecification } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { SF_BOUNDS, SF_CENTER, buildMapStyle } from "./map-style";

type Props = {
  pin?: { lat: number; lng: number } | null;
  flyTo?: { lat: number; lng: number; zoom?: number } | null;
  visibleLayers: Record<string, boolean>;
  onMapReady?: (map: MapLibreMap) => void;
};

const HAZARD_LAYERS: Array<{
  id: string;
  file: string;
  type: "fill" | "line" | "circle";
  paint: Record<string, unknown>;
  hueVar: string;
}> = [
  {
    id: "seismic_liquefaction",
    file: "/data/seismic_liquefaction.geojson",
    type: "fill",
    paint: {
      "fill-color": "var(--color-seismic)",
      "fill-opacity": 0.18,
      "fill-outline-color": "var(--color-seismic)",
    },
    hueVar: "var(--color-seismic)",
  },
  {
    id: "flood_fema",
    file: "/data/flood_fema.geojson",
    type: "fill",
    paint: { "fill-color": "var(--color-flood)", "fill-opacity": 0.22 },
    hueVar: "var(--color-flood)",
  },
  {
    id: "zoning_upzone",
    file: "/data/zoning_upzone.geojson",
    type: "line",
    paint: { "line-color": "var(--color-upzone)", "line-width": 3, "line-dasharray": [2, 2] },
    hueVar: "var(--color-upzone)",
  },
  {
    id: "safety_hin",
    file: "/data/safety_hin.geojson",
    type: "line",
    paint: { "line-color": "var(--color-safety)", "line-width": 2, "line-opacity": 0.7 },
    hueVar: "var(--color-safety)",
  },
  {
    id: "schools",
    file: "/data/schools.geojson",
    type: "circle",
    paint: { "circle-color": "var(--color-schools)", "circle-radius": 4, "circle-opacity": 0.85 },
    hueVar: "var(--color-schools)",
  },
  {
    id: "transit_bart",
    file: "/data/transit_bart.geojson",
    type: "circle",
    paint: {
      "circle-color": "var(--color-transit)",
      "circle-radius": 6,
      "circle-opacity": 0.9,
      "circle-stroke-color": "#fff",
      "circle-stroke-width": 2,
    },
    hueVar: "var(--color-transit)",
  },
  {
    id: "transit_muni_metro",
    file: "/data/transit_muni_metro.geojson",
    type: "circle",
    paint: { "circle-color": "var(--color-transit)", "circle-radius": 4, "circle-opacity": 0.7 },
    hueVar: "var(--color-transit)",
  },
  {
    id: "climate_fog",
    file: "/data/climate_fog.geojson",
    type: "fill",
    paint: { "fill-color": "var(--color-fog)", "fill-opacity": 0.08 },
    hueVar: "var(--color-fog)",
  },
];

// Resolve CSS var to actual hex by reading computed style at runtime.
function resolveCssVar(varRef: string): string {
  if (typeof window === "undefined") return "#888";
  const m = varRef.match(/var\((--[^)]+)\)/);
  if (!m) return varRef;
  const v = getComputedStyle(document.documentElement).getPropertyValue(m[1]!).trim();
  return v || "#888";
}

function resolvePaint(paint: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(paint)) {
    if (typeof v === "string" && v.startsWith("var(")) out[k] = resolveCssVar(v);
    else out[k] = v;
  }
  return out;
}

export default function MapView({ pin, flyTo, visibleLayers, onMapReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [styleReady, setStyleReady] = useState(false);

  // Style is resolved once on the client.
  const style = useMemo<string | StyleSpecification>(() => buildMapStyle(), []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: SF_CENTER,
      zoom: 12,
      minZoom: 11,
      maxBounds: SF_BOUNDS,
      attributionControl: { compact: true },
      pitchWithRotate: false,
      dragRotate: false,
      cooperativeGestures: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.on("load", () => {
      setStyleReady(true);
      onMapReady?.(map);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [style, onMapReady]);

  // Add hazard layers once the style is ready.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    for (const layer of HAZARD_LAYERS) {
      if (map.getSource(layer.id)) continue;
      map.addSource(layer.id, { type: "geojson", data: layer.file });
      map.addLayer({
        id: layer.id,
        source: layer.id,
        type: layer.type,
        paint: resolvePaint(layer.paint),
        layout: { visibility: (visibleLayers[layer.id] ?? true) ? "visible" : "none" },
        // biome-ignore lint/suspicious/noExplicitAny: MapLibre AddLayerObject narrows by `type`
      } as any);
    }
  }, [styleReady, visibleLayers]);

  // Toggle visibility when prop changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    for (const layer of HAZARD_LAYERS) {
      if (!map.getLayer(layer.id)) continue;
      map.setLayoutProperty(layer.id, "visibility", (visibleLayers[layer.id] ?? true) ? "visible" : "none");
    }
  }, [styleReady, visibleLayers]);

  // Pin marker
  const markerRef = useRef<maplibregl.Marker | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    if (pin) {
      const el = document.createElement("div");
      el.style.width = "20px";
      el.style.height = "20px";
      el.style.borderRadius = "999px";
      el.style.background = "var(--color-ink)";
      el.style.border = "3px solid white";
      el.style.boxShadow = "0 2px 12px rgb(0 0 0 / 0.4)";
      el.style.transform = "scale(0)";
      el.style.transition = "transform 200ms var(--ease-entrance)";
      const m = new maplibregl.Marker({ element: el }).setLngLat([pin.lng, pin.lat]).addTo(map);
      markerRef.current = m;
      // Animate in
      requestAnimationFrame(() => {
        el.style.transform = "scale(1)";
      });
    }
  }, [pin]);

  // FlyTo
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.flyTo({
      center: [flyTo.lng, flyTo.lat],
      zoom: flyTo.zoom ?? 16,
      duration: reduce ? 0 : 1200,
      essential: true,
    });
  }, [flyTo]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 bg-[#e8e3d6]"
      style={{ minHeight: "100dvh" }}
      role="application"
      aria-label="San Francisco map"
    />
  );
}
