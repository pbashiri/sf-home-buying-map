// One-shot data extraction from the v0 HTML prototype.
// Pulls hand-encoded GeoJSON / arrays out of v0/sf-neighborhood-risk-map.html
// and writes them as proper GeoJSON FeatureCollections to public/data/.
//
// Seed data for the active build. Real ingestion modules in src/server/ingest/*
// (and scripts/ingest-real.ts) overwrite these files on cron.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const V0_HTML = path.join(ROOT, "v0", "sf-neighborhood-risk-map.html");
const OUT_DIR = path.join(ROOT, "public", "data");

async function readHtml(): Promise<string> {
  return fs.readFile(V0_HTML, "utf8");
}

// Match a top-level `const NAME = …;` declaration up to the next `;\n`.
// Works only because v0 puts each constant on a single line.
function extractConstSingleLine(html: string, name: string): string {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*([^;\\n]+);`, "m");
  const m = html.match(re);
  if (!m || !m[1]) throw new Error(`Could not find single-line const ${name}`);
  return m[1].trim();
}

// Eval a JS literal (object / array). Done in a controlled way: we wrap in
// `(…)` and use Function to parse as expression. v0 is fully static literal data.
function parseLiteral<T>(src: string): T {
  // Drop trailing comments and trailing commas before } or ]
  const cleaned = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/,(\s*[}\]])/g, "$1");
  // biome-ignore lint/security/noGlobalEval: extracting trusted local data
  const fn = new Function(`return (${cleaned});`);
  return fn() as T;
}

// v0 stores polylines as [[lat, lng], …]. v1 GeoJSON is [[lng, lat], …].
function flipLatLng(line: number[][]): number[][] {
  return line.map(([lat, lng]) => [lng!, lat!]);
}

const ROOT_INGESTED_AT = new Date().toISOString();

type ManifestEntry = {
  layerId: string;
  file: string;
  source_url: string;
  source_label: string;
  ingested_at: string;
};

async function ensureDir(): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.writeFile(path.join(OUT_DIR, file), JSON.stringify(value), "utf8");
  console.log(`  wrote ${file} (${JSON.stringify(value).length} bytes)`);
}

async function main(): Promise<void> {
  await ensureDir();
  const html = await readHtml();
  const manifest: ManifestEntry[] = [];

  // --- Neighborhoods (uses the standalone _neighborhoods.geojson if present)
  const nhoodFile = path.join(ROOT, "v0", "_neighborhoods.geojson");
  try {
    const nhoodRaw = await fs.readFile(nhoodFile, "utf8");
    await fs.writeFile(path.join(OUT_DIR, "neighborhoods.geojson"), nhoodRaw, "utf8");
    console.log("  wrote neighborhoods.geojson (from v0/_neighborhoods.geojson)");
    manifest.push({
      layerId: "neighborhoods",
      file: "neighborhoods.geojson",
      source_url: "https://data.sfgov.org/Geographic-Locations-and-Boundaries/SF-Find-Neighborhoods/pty2-tcw4",
      source_label: "DataSF SF Find Neighborhoods",
      ingested_at: ROOT_INGESTED_AT,
    });
  } catch (err) {
    console.warn(`  skip neighborhoods.geojson: ${(err as Error).message}`);
  }

  // --- Liquefaction (CGS Seismic Hazard Zones) — single Feature in v0
  {
    const literal = extractConstSingleLine(html, "LIQ_ZONES");
    const liq = parseLiteral<GeoJSON.Feature>(literal);
    liq.properties = { ...(liq.properties ?? {}), layer_id: "seismic_liquefaction" };
    const fc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [liq] };
    await writeJson("seismic_liquefaction.geojson", fc);
    manifest.push({
      layerId: "seismic_liquefaction",
      file: "seismic_liquefaction.geojson",
      source_url: "https://maps.conservation.ca.gov/cgs/informationwarehouse/eqzapp/",
      source_label: "California Geological Survey Seismic Hazard Zones",
      ingested_at: ROOT_INGESTED_AT,
    });
  }

  // --- Flood zones — already a FeatureCollection
  {
    const literal = extractConstSingleLine(html, "FLOOD_ZONES");
    const fc = parseLiteral<GeoJSON.FeatureCollection>(literal);
    fc.features = fc.features.map((f) => ({
      ...f,
      properties: { ...(f.properties ?? {}), layer_id: "flood_fema" },
    }));
    await writeJson("flood_fema.geojson", fc);
    manifest.push({
      layerId: "flood_fema",
      file: "flood_fema.geojson",
      source_url: "https://msc.fema.gov/portal/search",
      source_label: "FEMA NFHL + SF Planning Combined Flood Map (hand-encoded approximation)",
      ingested_at: ROOT_INGESTED_AT,
    });
  }

  // --- Upzoned corridors (array of {line:[[lat,lng]…], name, maxHeight, stripe})
  {
    const literal = extractConstSingleLine(html, "UPZONED");
    type Up = { line: number[][]; name: string; maxHeight: number; stripe: string };
    const arr = parseLiteral<Up[]>(literal);
    const fc: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: arr.map((u, i) => ({
        type: "Feature",
        properties: {
          layer_id: "zoning_upzone",
          name: u.name,
          max_height_ft: u.maxHeight,
          stripe: u.stripe,
          source_id: `upzone_${i}`,
        },
        geometry: { type: "LineString", coordinates: flipLatLng(u.line) },
      })),
    };
    await writeJson("zoning_upzone.geojson", fc);
    manifest.push({
      layerId: "zoning_upzone",
      file: "zoning_upzone.geojson",
      source_url: "https://sfplanning.org/sf-family-zoning-plan",
      source_label: "SF Planning — SF Family Zoning Plan (effective 2026-01-12)",
      ingested_at: ROOT_INGESTED_AT,
    });
  }

  // --- Schools (array of {name, lat, lng, rating, level})
  {
    // SCHOOLS is multi-line in v0, so use the same regex pattern as MUNI/FOG below.
    const re = /const\s+SCHOOLS\s*=\s*\[([\s\S]*?)\];/;
    const m = html.match(re);
    if (!m || !m[1]) throw new Error("SCHOOLS not found");
    type Sch = { name: string; lat: number; lng: number; rating?: number; type?: string };
    const arr = parseLiteral<Sch[]>(`[${m[1]}]`);
    const fc: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: arr.map((s, i) => ({
        type: "Feature",
        properties: {
          layer_id: "schools",
          name: s.name,
          rating: s.rating ?? null,
          level: s.type ?? "school",
          source_id: `school_${i}`,
        },
        geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      })),
    };
    await writeJson("schools.geojson", fc);
    manifest.push({
      layerId: "schools",
      file: "schools.geojson",
      source_url: "https://www.sfusd.edu/schools",
      source_label: "SFUSD school directory + GreatSchools ratings (manual sync 2026-04)",
      ingested_at: ROOT_INGESTED_AT,
    });
  }

  // --- MUNI Metro stops (v0 fields: { n: name, lat, lng })
  {
    const re = /const\s+MUNI\s*=\s*\[([\s\S]*?)\];/;
    const m = html.match(re);
    if (!m || !m[1]) throw new Error("MUNI not found");
    type M = { n: string; lat: number; lng: number };
    const arr = parseLiteral<M[]>(`[${m[1]}]`);
    const fc: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: arr.map((s, i) => ({
        type: "Feature",
        properties: {
          layer_id: "transit",
          system: "muni_metro",
          name: s.n,
          source_id: `muni_${i}`,
        },
        geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      })),
    };
    await writeJson("transit_muni_metro.geojson", fc);
    manifest.push({
      layerId: "transit_muni_metro",
      file: "transit_muni_metro.geojson",
      source_url: "https://www.sfmta.com/maps/muni-metro-map",
      source_label: "SFMTA Muni Metro stops",
      ingested_at: ROOT_INGESTED_AT,
    });
  }

  // --- Fog bands. v0 uses { severity, band, polygon: [[lat,lng], ...] }.
  {
    const re = /const\s+FOG_BANDS\s*=\s*\[([\s\S]*?)\];/;
    const m = html.match(re);
    if (!m || !m[1]) throw new Error("FOG_BANDS not found");
    type B = { severity: string; band: string; polygon: number[][] };
    const arr = parseLiteral<B[]>(`[${m[1]}]`);
    const fc: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: arr.map((b, i) => ({
        type: "Feature",
        properties: {
          layer_id: "climate_fog",
          tier: b.band,
          severity: b.severity,
          source_id: `fog_${i}`,
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [...flipLatLng(b.polygon), [b.polygon[0]![1]!, b.polygon[0]![0]!]],
          ],
        },
      })),
    };
    await writeJson("climate_fog.geojson", fc);
    manifest.push({
      layerId: "climate_fog",
      file: "climate_fog.geojson",
      source_url: "https://nature.berkeley.edu/dawsonlab/Welcome.html",
      source_label: "UC Berkeley microclimate (Dawson Lab) — west-to-east fog gradient",
      ingested_at: ROOT_INGESTED_AT,
    });
  }

  await fs.writeFile(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
  console.log(`\nWrote manifest with ${manifest.length} entries.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
