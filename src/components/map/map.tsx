"use client";

import maplibregl, { type Map as MapLibreMap, type StyleSpecification } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { SF_BOUNDS, SF_CENTER, buildMapStyle } from "./map-style";

type Props = {
  pin?: { lat: number; lng: number } | null;
  flyTo?: { lat: number; lng: number; zoom?: number } | null;
  visibleLayers: Record<string, boolean>;
  /**
   * Map padding (px) on each side of the visible viewport. Used to keep the
   * pin and animation centered in the *visible* area when overlay UI (the
   * right panel, a bottom sheet, etc.) covers part of the canvas.
   */
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
  /** When true, the map slowly drifts/breathes — used on the hero before any address is selected. */
  idle?: boolean;
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

/**
 * Builds the premium pin element: a black "drop" with a coloured core and an
 * animated halo ring that slowly pulses to draw the eye.
 */
function buildMarkerEl(): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "theami-pin";
  wrap.style.cssText = `
    position: relative;
    width: 34px;
    height: 34px;
    pointer-events: auto;
    z-index: 999;
    animation: marker-drop 280ms cubic-bezier(0.22, 1, 0.36, 1) both;
  `;

  const halo = document.createElement("div");
  halo.style.cssText = `
    position: absolute;
    inset: 0;
    border-radius: 999px;
    background: radial-gradient(circle, rgba(176,68,37,0.45) 0%, rgba(176,68,37,0.0) 70%);
    animation: marker-pulse 1800ms cubic-bezier(0.22, 1, 0.36, 1) infinite;
  `;
  wrap.appendChild(halo);

  const dot = document.createElement("div");
  dot.style.cssText = `
    position: absolute;
    inset: 6px;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    background: #0a0a0a;
    border: 3px solid white;
    box-shadow: 0 4px 14px rgba(0,0,0,0.45);
  `;
  wrap.appendChild(dot);

  const core = document.createElement("div");
  core.style.cssText = `
    position: absolute;
    inset: 11px;
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: #b04425;
  `;
  wrap.appendChild(core);

  return wrap;
}

export default function MapView({ pin, flyTo, visibleLayers, padding, idle = false, onMapReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [styleReady, setStyleReady] = useState(false);

  const style = useMemo<string | StyleSpecification>(() => buildMapStyle(), []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: SF_CENTER,
      zoom: 11.45,
      bearing: -8,
      pitch: 0,
      minZoom: 10.25,
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

  // Idle "breathing" pan on the hero. Slow ellipse around SF.
  const idleRef = useRef<number | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    if (!idle) {
      if (idleRef.current !== null) {
        cancelAnimationFrame(idleRef.current);
        idleRef.current = null;
      }
      return;
    }
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const start = performance.now();
    const cx = SF_CENTER[0];
    const cy = SF_CENTER[1];
    const ax = 0.012; // ~1.3 km E-W radius
    const ay = 0.006; // ~0.6 km N-S radius
    const period = 60_000; // 60 s for a full ellipse — almost imperceptible

    const tick = (now: number) => {
      const t = ((now - start) % period) / period;
      const angle = t * Math.PI * 2;
      // Don't fight the user — bail if they're interacting.
      if (map.isMoving() || map.isZooming() || map.isRotating()) {
        idleRef.current = requestAnimationFrame(tick);
        return;
      }
      const lng = cx + Math.cos(angle) * ax;
      const lat = cy + Math.sin(angle) * ay;
      map.jumpTo({ center: [lng, lat] });
      idleRef.current = requestAnimationFrame(tick);
    };

    idleRef.current = requestAnimationFrame(tick);
    return () => {
      if (idleRef.current !== null) {
        cancelAnimationFrame(idleRef.current);
        idleRef.current = null;
      }
    };
  }, [idle, styleReady]);

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

  // Premium pin marker with pulsing halo. We key off lat/lng primitives so
  // re-renders that produce a new `pin` object (but identical coords) don't
  // tear down and re-mount the marker — that would restart its drop animation
  // on every parent render and effectively hide it. We also wait for the
  // style to be ready, otherwise MapLibre's marker projection can place the
  // element at (0, 0) before the camera/style is fully initialised.
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const pinLat = pin?.lat;
  const pinLng = pin?.lng;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    if (pinLat !== undefined && pinLng !== undefined) {
      const el = buildMarkerEl();
      const m = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([pinLng, pinLat])
        .addTo(map);
      markerRef.current = m;
    }
  }, [pinLat, pinLng, styleReady]);

  // Track the latest padding via a ref so the flyTo effect doesn't re-trigger
  // on padding-only changes (those are handled smoothly by the next effect).
  const paddingRef = useRef(padding);
  useEffect(() => {
    paddingRef.current = padding;
  }, [padding]);

  // FlyTo — when the user picks an address. We key off primitive lat/lng/zoom
  // so a new `flyTo` object reference with identical coords doesn't restart
  // the animation and effectively freeze the camera mid-flight.
  const flyLat = flyTo?.lat;
  const flyLng = flyTo?.lng;
  const flyZoom = flyTo?.zoom;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady || flyLat === undefined || flyLng === undefined) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const p = paddingRef.current;
    map.flyTo({
      center: [flyLng, flyLat],
      zoom: flyZoom ?? 16,
      bearing: 0,
      duration: reduce ? 0 : 1400,
      curve: 1.42,
      essential: true,
      padding: {
        top: p?.top ?? 0,
        right: p?.right ?? 0,
        bottom: p?.bottom ?? 0,
        left: p?.left ?? 0,
      },
    });
  }, [flyLat, flyLng, flyZoom, styleReady]);

  // If padding changes while a pin is in place (e.g. panel opens/closes after
  // selection), gently re-center so the pin stays in the visible window.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady || pinLat === undefined || pinLng === undefined) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.easeTo({
      center: [pinLng, pinLat],
      duration: reduce ? 0 : 420,
      padding: {
        top: padding?.top ?? 0,
        right: padding?.right ?? 0,
        bottom: padding?.bottom ?? 0,
        left: padding?.left ?? 0,
      },
    });
  }, [padding?.top, padding?.right, padding?.bottom, padding?.left, pinLat, pinLng, styleReady]);

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
