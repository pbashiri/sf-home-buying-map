// URL is the canonical state. /?lat=…&lng=…&h=10 is the source of truth.
// /compare?addr=lat,lng,horizon|lat,lng,horizon|… for compare pages.

import type { Horizon } from "@/types/concern";

export type AddressUrlState = {
  lat: number;
  lng: number;
  horizon: Horizon;
  label?: string;
};

export function encodeAddress(state: AddressUrlState): URLSearchParams {
  const sp = new URLSearchParams();
  sp.set("lat", state.lat.toFixed(5));
  sp.set("lng", state.lng.toFixed(5));
  sp.set("h", String(state.horizon));
  if (state.label) sp.set("q", state.label);
  return sp;
}

export function decodeAddress(sp: URLSearchParams): AddressUrlState | null {
  const lat = Number.parseFloat(sp.get("lat") ?? "");
  const lng = Number.parseFloat(sp.get("lng") ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const hRaw = Number.parseInt(sp.get("h") ?? "10", 10);
  const horizon: Horizon = hRaw === 5 || hRaw === 7 || hRaw === 15 ? hRaw : 10;
  const label = sp.get("q") ?? undefined;
  return { lat, lng, horizon, label };
}

export function compareSerialise(states: AddressUrlState[]): string {
  return states
    .map((s) => {
      const base = `${s.lat.toFixed(5)},${s.lng.toFixed(5)},${s.horizon}`;
      return s.label ? `${base},${encodeURIComponent(s.label)}` : base;
    })
    .join("|");
}

export function compareParse(s: string): AddressUrlState[] {
  return s
    .split("|")
    .map((token) => {
      const parts = token.split(",");
      const lat = Number.parseFloat(parts[0] ?? "");
      const lng = Number.parseFloat(parts[1] ?? "");
      const h = Number.parseInt(parts[2] ?? "10", 10);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const horizon: Horizon = h === 5 || h === 7 || h === 15 ? h : 10;
      const label = parts[3] ? decodeURIComponent(parts.slice(3).join(",")) : undefined;
      const parsed: AddressUrlState = { lat, lng, horizon };
      if (label) parsed.label = label;
      return parsed;
    })
    .filter((s): s is AddressUrlState => s !== null);
}
