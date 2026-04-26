// Google Places (New) + Geocoding proxy. Server-only.
// When GOOGLE_MAPS_API_KEY is missing, falls back to a local SF gazetteer
// of well-known neighborhoods + 321 Church St + a few popular addresses,
// plus Nominatim (OSM) for unknown queries.

import type { Address } from "@/types/concern";

export type SuggestItem = {
  place_id: string;
  description: string;
  source: "google" | "gazetteer" | "nominatim";
};

const SF_GAZETTEER: Array<{ id: string; description: string; lat: number; lng: number }> = [
  { id: "g_321_church", description: "321 Church St, San Francisco, CA 94114", lat: 37.7665, lng: -122.4294 },
  { id: "g_nopa", description: "NOPA, San Francisco, CA", lat: 37.7783, lng: -122.4425 },
  { id: "g_cole_valley", description: "Cole Valley, San Francisco, CA", lat: 37.766, lng: -122.451 },
  { id: "g_hayes_valley", description: "Hayes Valley, San Francisco, CA", lat: 37.7763, lng: -122.4257 },
  { id: "g_dolores", description: "Mission Dolores, San Francisco, CA", lat: 37.7634, lng: -122.4253 },
  { id: "g_corona_heights", description: "Corona Heights, San Francisco, CA", lat: 37.7643, lng: -122.438 },
  { id: "g_noe", description: "Noe Valley, San Francisco, CA", lat: 37.7507, lng: -122.4337 },
  { id: "g_duboce", description: "Duboce Triangle, San Francisco, CA", lat: 37.7665, lng: -122.4322 },
  { id: "g_castro", description: "The Castro, San Francisco, CA", lat: 37.7609, lng: -122.435 },
  { id: "g_marina", description: "Marina, San Francisco, CA", lat: 37.8022, lng: -122.4378 },
  { id: "g_pacific_heights", description: "Pacific Heights, San Francisco, CA", lat: 37.7919, lng: -122.432 },
  { id: "g_richmond", description: "Inner Richmond, San Francisco, CA", lat: 37.7799, lng: -122.4666 },
  { id: "g_sunset", description: "Inner Sunset, San Francisco, CA", lat: 37.7619, lng: -122.4661 },
  { id: "g_mission_bay", description: "Mission Bay, San Francisco, CA", lat: 37.77, lng: -122.388 },
  { id: "g_potrero_hill", description: "Potrero Hill, San Francisco, CA", lat: 37.7587, lng: -122.4007 },
  { id: "g_bernal", description: "Bernal Heights, San Francisco, CA", lat: 37.7396, lng: -122.4147 },
  { id: "g_outer_richmond", description: "Outer Richmond, San Francisco, CA", lat: 37.7779, lng: -122.4954 },
  { id: "g_outer_sunset", description: "Outer Sunset, San Francisco, CA", lat: 37.7558, lng: -122.493 },
  { id: "g_glen_park", description: "Glen Park, San Francisco, CA", lat: 37.7367, lng: -122.4338 },
  {
    id: "g_lower_pac",
    description: "Lower Pacific Heights, San Francisco, CA",
    lat: 37.7846,
    lng: -122.4366,
  },
  { id: "g_haight", description: "Haight-Ashbury, San Francisco, CA", lat: 37.7692, lng: -122.4481 },
  { id: "g_soma", description: "SoMa, San Francisco, CA", lat: 37.7788, lng: -122.4054 },
  { id: "g_north_beach", description: "North Beach, San Francisco, CA", lat: 37.8003, lng: -122.4101 },
  { id: "g_chinatown", description: "Chinatown, San Francisco, CA", lat: 37.7941, lng: -122.4078 },
  { id: "g_russian_hill", description: "Russian Hill, San Francisco, CA", lat: 37.8014, lng: -122.4192 },
  { id: "g_nob_hill", description: "Nob Hill, San Francisco, CA", lat: 37.793, lng: -122.4161 },
  { id: "g_telegraph", description: "Telegraph Hill, San Francisco, CA", lat: 37.8024, lng: -122.4058 },
  {
    id: "g_western_addition",
    description: "Western Addition, San Francisco, CA",
    lat: 37.782,
    lng: -122.4324,
  },
  { id: "g_japantown", description: "Japantown, San Francisco, CA", lat: 37.7853, lng: -122.4292 },
  { id: "g_visitacion", description: "Visitacion Valley, San Francisco, CA", lat: 37.7163, lng: -122.4067 },
  { id: "g_excelsior", description: "Excelsior, San Francisco, CA", lat: 37.724, lng: -122.43 },
  { id: "g_bayview", description: "Bayview-Hunters Point, San Francisco, CA", lat: 37.729, lng: -122.3833 },
  { id: "g_dogpatch", description: "Dogpatch, San Francisco, CA", lat: 37.76, lng: -122.3895 },
  { id: "g_presidio", description: "Presidio Heights, San Francisco, CA", lat: 37.7888, lng: -122.4525 },
  { id: "g_lone_mountain", description: "Lone Mountain, San Francisco, CA", lat: 37.7793, lng: -122.4517 },
  { id: "g_twin_peaks", description: "Twin Peaks, San Francisco, CA", lat: 37.7544, lng: -122.4477 },
  { id: "g_diamond_heights", description: "Diamond Heights, San Francisco, CA", lat: 37.744, lng: -122.4424 },
  { id: "g_seacliff", description: "Sea Cliff, San Francisco, CA", lat: 37.7853, lng: -122.492 },
  { id: "g_lake_district", description: "Lake Street, San Francisco, CA", lat: 37.7853, lng: -122.4661 },
];

function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return true;
  // Simple token-prefix match
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((tok) => t.includes(tok));
}

export async function suggest(query: string): Promise<SuggestItem[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (apiKey) {
    try {
      const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          input: trimmed,
          locationBias: {
            rectangle: {
              low: { latitude: 37.7, longitude: -122.515 },
              high: { latitude: 37.835, longitude: -122.355 },
            },
          },
          includedRegionCodes: ["US"],
        }),
      });
      if (res.ok) {
        type Resp = {
          suggestions?: Array<{ placePrediction?: { placeId: string; text?: { text: string } } }>;
        };
        const data = (await res.json()) as Resp;
        const items: SuggestItem[] = (data.suggestions ?? [])
          .map((s) => s.placePrediction)
          .filter((p): p is NonNullable<typeof p> => Boolean(p))
          .map((p) => ({
            place_id: p.placeId,
            description: p.text?.text ?? p.placeId,
            source: "google" as const,
          }));
        if (items.length > 0) return items;
      }
    } catch (err) {
      console.warn("[places] google autocomplete failed:", err);
    }
  }

  // Local gazetteer
  const local = SF_GAZETTEER.filter((g) => fuzzyMatch(trimmed, g.description))
    .slice(0, 8)
    .map((g) => ({ place_id: g.id, description: g.description, source: "gazetteer" as const }));
  if (local.length > 0) return local;

  // Nominatim fallback (rate-limited; OK for dev)
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", `${trimmed}, San Francisco, CA`);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "5");
    url.searchParams.set("countrycodes", "us");
    const res = await fetch(url.toString(), {
      headers: { "user-agent": "theami-v1 (https://theami.ai)" },
    });
    if (res.ok) {
      type Hit = { display_name: string; lat: string; lon: string; place_id: number };
      const arr = (await res.json()) as Hit[];
      return arr
        .filter((h) => {
          const lat = Number.parseFloat(h.lat);
          const lng = Number.parseFloat(h.lon);
          return lat >= 37.7 && lat <= 37.835 && lng >= -122.515 && lng <= -122.355;
        })
        .map((h) => ({
          place_id: `osm_${h.place_id}_${h.lat}_${h.lon}`,
          description: h.display_name,
          source: "nominatim" as const,
        }));
    }
  } catch (err) {
    console.warn("[places] nominatim failed:", err);
  }

  return [];
}

export async function geocode(placeId: string): Promise<Address | null> {
  // Local gazetteer hit
  const local = SF_GAZETTEER.find((g) => g.id === placeId);
  if (local) {
    return {
      lat: local.lat,
      lng: local.lng,
      formatted: local.description,
    };
  }

  // OSM-encoded place_id format: osm_{id}_{lat}_{lng}
  if (placeId.startsWith("osm_")) {
    const parts = placeId.split("_");
    const lat = Number.parseFloat(parts[parts.length - 2] ?? "");
    const lng = Number.parseFloat(parts[parts.length - 1] ?? "");
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }

  // Google Places
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
        headers: {
          "x-goog-api-key": apiKey,
          "x-goog-fieldmask": "id,formattedAddress,location,addressComponents",
        },
      });
      if (res.ok) {
        type Resp = {
          formattedAddress?: string;
          location?: { latitude: number; longitude: number };
          addressComponents?: Array<{ types: string[]; longText: string }>;
        };
        const data = (await res.json()) as Resp;
        if (data.location) {
          const zip = data.addressComponents?.find((c) => c.types.includes("postal_code"))?.longText;
          const neighborhood = data.addressComponents?.find((c) =>
            c.types.includes("neighborhood"),
          )?.longText;
          return {
            lat: data.location.latitude,
            lng: data.location.longitude,
            formatted: data.formattedAddress,
            zip,
            neighborhood,
          };
        }
      }
    } catch (err) {
      console.warn("[places] google geocode failed:", err);
    }
  }

  return null;
}
