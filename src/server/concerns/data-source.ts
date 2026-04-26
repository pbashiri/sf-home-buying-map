// LayerProvider abstraction. Default: read versioned GeoJSON from public/data/.
// Future: swap for PostGIS via Drizzle when DATABASE_URL is set.
// Same interface either way.

import { promises as fs } from "node:fs";
import path from "node:path";
import type { FeatureCollection } from "geojson";

const DATA_DIR = path.join(process.cwd(), "public", "data");
const cache = new Map<string, { value: FeatureCollection; mtime: number }>();

async function readJson<T>(file: string): Promise<T> {
  const fpath = path.join(DATA_DIR, file);
  const stat = await fs.stat(fpath);
  const cached = cache.get(file);
  if (cached && cached.mtime === stat.mtimeMs) return cached.value as T;
  const buf = await fs.readFile(fpath, "utf8");
  const parsed = JSON.parse(buf) as T;
  cache.set(file, { value: parsed as unknown as FeatureCollection, mtime: stat.mtimeMs });
  return parsed;
}

export async function loadFeatureCollection<TProps extends object = Record<string, unknown>>(
  file: string,
): Promise<FeatureCollection> {
  return readJson<FeatureCollection>(file);
}

export async function maybeLoad(file: string): Promise<FeatureCollection | null> {
  try {
    return await loadFeatureCollection(file);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw err;
  }
}

// Provenance shipped with each layer file.
export type LayerManifestEntry = {
  layerId: string;
  file: string;
  source_url: string;
  source_label: string;
  ingested_at: string; // ISO
};

export async function loadManifest(): Promise<LayerManifestEntry[]> {
  return readJson<LayerManifestEntry[]>("manifest.json");
}
