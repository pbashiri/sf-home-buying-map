// Real ingestion script. Pulls fresh data from public APIs and writes
// versioned GeoJSON to public/data/. Updates manifest.json in place.
//
// Run: npm run ingest:all
//
// Skips any source that 4xx / 5xxs after 2 retries; logs and continues.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const OUT_DIR = path.resolve(path.dirname(__filename), "..", "public", "data");

type ManifestEntry = {
  layerId: string;
  file: string;
  source_url: string;
  source_label: string;
  ingested_at: string;
};

async function loadManifest(): Promise<ManifestEntry[]> {
  try {
    const buf = await fs.readFile(path.join(OUT_DIR, "manifest.json"), "utf8");
    return JSON.parse(buf) as ManifestEntry[];
  } catch {
    return [];
  }
}

async function saveManifest(m: ManifestEntry[]): Promise<void> {
  await fs.writeFile(path.join(OUT_DIR, "manifest.json"), JSON.stringify(m, null, 2), "utf8");
}

function upsertManifest(m: ManifestEntry[], entry: ManifestEntry): ManifestEntry[] {
  const idx = m.findIndex((e) => e.layerId === entry.layerId);
  if (idx >= 0) m[idx] = entry;
  else m.push(entry);
  return m;
}

async function fetchJson<T>(url: string, init?: RequestInit, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          accept: "application/json",
          "user-agent": "theami-v1-ingest/0.1 (https://theami.ai)",
          ...(init?.headers ?? {}),
        },
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return (await res.json()) as T;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  throw new Error("unreachable");
}

async function writeGeoJson(file: string, fc: GeoJSON.FeatureCollection): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUT_DIR, file), JSON.stringify(fc), "utf8");
  console.log(`  wrote ${file} (${fc.features.length} features)`);
}

const NOW = new Date().toISOString();

// --------------------------------------------------------------------------
// Soft-story properties (DataSF jwdp-cqyc) — currently returns empty objects
// (dataset access appears restricted). We fall back to neighborhood density
// tiers shipped as a static GeoJSON in seed/, so this ingest is best-effort.
// --------------------------------------------------------------------------
async function ingestSoftStory(m: ManifestEntry[]): Promise<void> {
  console.log("[ingest] soft-story (DataSF jwdp-cqyc — best-effort)");
  type Row = {
    blklot?: string;
    address?: string;
    location_1?: { latitude: string; longitude: string };
    point?: { coordinates: [number, number] };
    latitude?: string;
    longitude?: string;
    status?: string;
  };
  const rows = await fetchJson<Row[]>(
    `https://data.sfgov.org/resource/jwdp-cqyc.json?$limit=10000${
      process.env.DATASF_APP_TOKEN ? `&$$app_token=${process.env.DATASF_APP_TOKEN}` : ""
    }`,
  );
  const features: GeoJSON.Feature[] = [];
  for (const [i, r] of rows.entries()) {
    const lat =
      (r.location_1?.latitude && Number.parseFloat(r.location_1.latitude)) ||
      (r.latitude && Number.parseFloat(r.latitude)) ||
      r.point?.coordinates?.[1];
    const lng =
      (r.location_1?.longitude && Number.parseFloat(r.location_1.longitude)) ||
      (r.longitude && Number.parseFloat(r.longitude)) ||
      r.point?.coordinates?.[0];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    features.push({
      type: "Feature",
      properties: {
        layer_id: "seismic_softstory",
        source_id: r.blklot ?? `softstory_${i}`,
        address: r.address ?? null,
        status: r.status ?? null,
      },
      geometry: { type: "Point", coordinates: [lng!, lat!] },
    });
  }
  if (features.length === 0) {
    console.log("  (DataSF returned 0 usable rows; keeping prior file if present)");
    return;
  }
  await writeGeoJson("seismic_softstory.geojson", { type: "FeatureCollection", features });
  upsertManifest(m, {
    layerId: "seismic_softstory",
    file: "seismic_softstory.geojson",
    source_url: "https://data.sfgov.org/Housing-and-Buildings/Map-of-Soft-Story-Properties/jwdp-cqyc",
    source_label: "DataSF — Soft-Story Properties",
    ingested_at: NOW,
  });
}

// --------------------------------------------------------------------------
// SFPD incidents, last 365 days (DataSF wg3w-h783)
// --------------------------------------------------------------------------
async function ingestCrime(m: ManifestEntry[]): Promise<void> {
  console.log("[ingest] crime (DataSF wg3w-h783, rolling 365 days)");
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 365);
  type Row = {
    incident_id?: string;
    incident_category?: string;
    incident_subcategory?: string;
    incident_datetime?: string;
    latitude?: string;
    longitude?: string;
  };
  const url = new URL("https://data.sfgov.org/resource/wg3w-h783.json");
  // Socrata accepts ISO-8601 datetimes without quotes for `_FloatingTimestamp` columns.
  const isoCut = cutoff.toISOString().slice(0, 19); // strip ms+Z
  url.searchParams.set(
    "$where",
    `incident_datetime > '${isoCut}' AND latitude IS NOT NULL AND longitude IS NOT NULL`,
  );
  url.searchParams.set("$limit", "50000");
  url.searchParams.set(
    "$select",
    "incident_id,incident_category,incident_subcategory,incident_datetime,latitude,longitude",
  );
  if (process.env.DATASF_APP_TOKEN) url.searchParams.set("$$app_token", process.env.DATASF_APP_TOKEN);
  const rows = await fetchJson<Row[]>(url.toString());
  const features: GeoJSON.Feature[] = [];
  for (const r of rows) {
    const lat = r.latitude ? Number.parseFloat(r.latitude) : Number.NaN;
    const lng = r.longitude ? Number.parseFloat(r.longitude) : Number.NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    features.push({
      type: "Feature",
      properties: {
        layer_id: "safety_crime",
        source_id: r.incident_id,
        category: r.incident_category ?? null,
        subcategory: r.incident_subcategory ?? null,
        occurred_at: r.incident_datetime ?? null,
      },
      geometry: { type: "Point", coordinates: [lng, lat] },
    });
  }
  await writeGeoJson("safety_crime.geojson", { type: "FeatureCollection", features });
  upsertManifest(m, {
    layerId: "safety_crime",
    file: "safety_crime.geojson",
    source_url: "https://data.sfgov.org/Public-Safety/Police-Department-Incident-Reports-2018-to-Present/wg3w-h783",
    source_label: "DataSF — SFPD Incident Reports (rolling 365 days)",
    ingested_at: NOW,
  });
}

// --------------------------------------------------------------------------
// DBI building permits, last 24 months (DataSF i98e-djp9)
// --------------------------------------------------------------------------
async function ingestPermits(m: ManifestEntry[]): Promise<void> {
  console.log("[ingest] dbi permits (DataSF i98e-djp9, last 24 months)");
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 24);
  type Row = {
    permit_number?: string;
    description?: string;
    permit_type_definition?: string;
    status?: string;
    filed_date?: string;
    last_action?: string;
    location?: { coordinates?: [number, number] };
  };
  const url = new URL("https://data.sfgov.org/resource/i98e-djp9.json");
  url.searchParams.set(
    "$where",
    `filed_date > '${cutoff.toISOString().slice(0, 10)}' AND location IS NOT NULL`,
  );
  url.searchParams.set("$limit", "20000");
  if (process.env.DATASF_APP_TOKEN) url.searchParams.set("$$app_token", process.env.DATASF_APP_TOKEN);
  const rows = await fetchJson<Row[]>(url.toString());
  const features: GeoJSON.Feature[] = [];
  for (const r of rows) {
    const c = r.location?.coordinates;
    if (!c || c.length < 2) continue;
    features.push({
      type: "Feature",
      properties: {
        layer_id: "construction_permits",
        source_id: r.permit_number,
        description: r.description ?? null,
        type: r.permit_type_definition ?? null,
        status: r.status ?? null,
        filed_at: r.filed_date ?? null,
        last_action_at: r.last_action ?? null,
      },
      geometry: { type: "Point", coordinates: [c[0]!, c[1]!] },
    });
  }
  await writeGeoJson("construction_permits.geojson", { type: "FeatureCollection", features });
  upsertManifest(m, {
    layerId: "construction_permits",
    file: "construction_permits.geojson",
    source_url: "https://data.sfgov.org/Housing-and-Buildings/Building-Permits/i98e-djp9",
    source_label: "DataSF — DBI Building Permits (last 24 months)",
    ingested_at: NOW,
  });
}

// --------------------------------------------------------------------------
// Street trees (DataSF) — sampled subset for canopy heuristic
// --------------------------------------------------------------------------
async function ingestStreetTrees(m: ManifestEntry[]): Promise<void> {
  console.log("[ingest] street trees (DataSF tkzw-k3nq, 30k sample)");
  type Row = {
    treeid?: string;
    qspecies?: string;
    latitude?: string;
    longitude?: string;
  };
  const url = new URL("https://data.sfgov.org/resource/tkzw-k3nq.json");
  url.searchParams.set("$where", "latitude IS NOT NULL AND longitude IS NOT NULL");
  url.searchParams.set("$select", "treeid,qspecies,latitude,longitude");
  url.searchParams.set("$limit", "30000");
  if (process.env.DATASF_APP_TOKEN) url.searchParams.set("$$app_token", process.env.DATASF_APP_TOKEN);
  const rows = await fetchJson<Row[]>(url.toString());
  const features: GeoJSON.Feature[] = [];
  for (const r of rows) {
    const lat = r.latitude ? Number.parseFloat(r.latitude) : Number.NaN;
    const lng = r.longitude ? Number.parseFloat(r.longitude) : Number.NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    features.push({
      type: "Feature",
      properties: { layer_id: "quality_trees", source_id: r.treeid, species: r.qspecies ?? null },
      geometry: { type: "Point", coordinates: [lng, lat] },
    });
  }
  const fc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features };
  await writeGeoJson("quality_trees.geojson", fc);
  upsertManifest(m, {
    layerId: "quality_trees",
    file: "quality_trees.geojson",
    source_url: "https://data.sfgov.org/City-Infrastructure/Street-Tree-List/tkzw-k3nq",
    source_label: "DataSF — Street Tree List (30k sample)",
    ingested_at: NOW,
  });
}

// --------------------------------------------------------------------------
// BART stations (BART API — JSON, no auth required for stations endpoint)
// --------------------------------------------------------------------------
async function ingestBart(m: ManifestEntry[]): Promise<void> {
  console.log("[ingest] BART stations (api.bart.gov)");
  type StationsRoot = {
    root?: {
      stations?: { station: Array<{ name: string; abbr: string; gtfs_latitude: string; gtfs_longitude: string }> };
    };
  };
  const url =
    "https://api.bart.gov/api/stn.aspx?cmd=stns&key=MW9S-E7SL-26DU-VV8V&json=y";
  const root = await fetchJson<StationsRoot>(url);
  const stations = root.root?.stations?.station ?? [];
  const sf = stations.filter((s) => {
    const lat = Number.parseFloat(s.gtfs_latitude);
    const lng = Number.parseFloat(s.gtfs_longitude);
    return lat >= 37.7 && lat <= 37.835 && lng >= -122.515 && lng <= -122.355;
  });
  const fc: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: sf.map((s) => ({
      type: "Feature",
      properties: {
        layer_id: "transit",
        system: "bart",
        name: s.name,
        abbr: s.abbr,
        source_id: `bart_${s.abbr}`,
      },
      geometry: {
        type: "Point",
        coordinates: [Number.parseFloat(s.gtfs_longitude), Number.parseFloat(s.gtfs_latitude)],
      },
    })),
  };
  await writeGeoJson("transit_bart.geojson", fc);
  upsertManifest(m, {
    layerId: "transit_bart",
    file: "transit_bart.geojson",
    source_url: "https://www.bart.gov/schedules/developers/stations",
    source_label: "BART — Stations API",
    ingested_at: NOW,
  });
}

// --------------------------------------------------------------------------
// Vision Zero High Injury Network (DataSF) — line geometry
// --------------------------------------------------------------------------
async function ingestHIN(m: ManifestEntry[]): Promise<void> {
  console.log("[ingest] Vision Zero HIN (DataSF enwt-3u8m)");
  const url = new URL("https://data.sfgov.org/resource/enwt-3u8m.geojson");
  url.searchParams.set("$limit", "5000");
  if (process.env.DATASF_APP_TOKEN) url.searchParams.set("$$app_token", process.env.DATASF_APP_TOKEN);
  const fc = await fetchJson<GeoJSON.FeatureCollection>(url.toString());
  fc.features = fc.features.map((f) => ({
    ...f,
    properties: { ...(f.properties ?? {}), layer_id: "safety_hin" },
  }));
  await writeGeoJson("safety_hin.geojson", fc);
  upsertManifest(m, {
    layerId: "safety_hin",
    file: "safety_hin.geojson",
    source_url: "https://data.sfgov.org/Transportation/2024-High-Injury-Network/enwt-3u8m",
    source_label: "DataSF — 2024 High Injury Network",
    ingested_at: NOW,
  });
}

// --------------------------------------------------------------------------
// Seismic Hazard Zones (DataSF re79-p8j5)
//
// DataSF mirrors the California Geological Survey regulatory map clipped to
// SF, so this is the authoritative source for the liquefaction overlay. The
// dataset is a single tabular view of MultiPolygon rows (id + the_geom);
// the three zone types (liquefaction, earthquake-induced landslide, both)
// are not tagged in the public columns, which matches CGS's regulatory map
// where the "Seismic Hazard Zone" boundary is the actionable polygon.
//
// We tag every feature with `layer_id: "seismic_liquefaction"` so the
// existing point-in-polygon concern logic and map fill paint keep working.
// --------------------------------------------------------------------------
async function ingestSeismicLiquefaction(m: ManifestEntry[]): Promise<void> {
  console.log("[ingest] seismic hazard zones (DataSF re79-p8j5)");
  const url = new URL("https://data.sfgov.org/resource/re79-p8j5.geojson");
  url.searchParams.set("$limit", "5000");
  if (process.env.DATASF_APP_TOKEN) url.searchParams.set("$$app_token", process.env.DATASF_APP_TOKEN);
  const fc = await fetchJson<GeoJSON.FeatureCollection>(url.toString());
  fc.features = fc.features.map((f) => ({
    ...f,
    properties: {
      ...(f.properties ?? {}),
      layer_id: "seismic_liquefaction",
      label: "CGS Seismic Hazard Zone",
    },
  }));
  await writeGeoJson("seismic_liquefaction.geojson", fc);
  upsertManifest(m, {
    layerId: "seismic_liquefaction",
    file: "seismic_liquefaction.geojson",
    source_url: "https://data.sfgov.org/-/San-Francisco-Seismic-Hazard-Zones/7ahv-68ap",
    source_label: "DataSF — San Francisco Seismic Hazard Zones (CGS regulatory map)",
    ingested_at: NOW,
  });
}

// --------------------------------------------------------------------------
// Article 10 / 11 historic districts (SF Planning) — try DataSF mirror first
// --------------------------------------------------------------------------
async function ingestHistoric(m: ManifestEntry[]): Promise<void> {
  // SF historic districts aren't published on DataSF as a standalone GeoJSON
  // dataset that's reachable without an ArcGIS REST query. Skipping for v1
  // seed; ingestion will be wired to SF Planning ArcGIS in a follow-up.
  console.log("[ingest] historic districts — deferred (no public GeoJSON endpoint)");
  void m;
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------
async function main(): Promise<void> {
  const m = await loadManifest();
  const tasks: Array<[string, (m: ManifestEntry[]) => Promise<void>]> = [
    ["soft-story", ingestSoftStory],
    ["crime", ingestCrime],
    ["permits", ingestPermits],
    ["trees", ingestStreetTrees],
    ["bart", ingestBart],
    ["hin", ingestHIN],
    ["seismic-liquefaction", ingestSeismicLiquefaction],
    ["historic", ingestHistoric],
  ];
  for (const [name, fn] of tasks) {
    try {
      await fn(m);
    } catch (err) {
      console.warn(`  ! ${name} failed: ${(err as Error).message}`);
    }
    await saveManifest(m);
  }
  console.log("\nIngestion complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
