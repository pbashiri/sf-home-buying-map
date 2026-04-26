// concernsAt(lat, lng, horizon) — runs the spatial query across all 20 layers
// and returns a structured Concern[] with provenance. The LLM never invents
// claims; it only summarizes this array. SPEC §3.1.

import { createHash } from "node:crypto";
import { distanceToLineStringMeters, haversineMeters, isInSF, pointInPolygon } from "@/lib/geo";
import type { Address, Concern, Horizon, LayerId } from "@/types/concern";
import type { Feature, FeatureCollection, LineString, MultiPolygon, Polygon } from "geojson";
import { maybeLoad } from "./data-source";
import { type SeverityKey, severityFor } from "./severity";

// Neighborhood-level soft-story density tiers, derived from v0 prose.
// Tract-level density categories that meaningfully change the action item.
const SOFTSTORY_TIERS: Record<string, "high" | "moderate" | "low"> = {
  "Castro/Upper Market": "moderate",
  Mission: "high",
  "North Beach": "high",
  Marina: "high",
  "Outer Richmond": "high",
  "Inner Richmond": "high",
  "Outer Sunset": "moderate",
  "Inner Sunset": "moderate",
  "Russian Hill": "high",
  Tenderloin: "high",
  Chinatown: "high",
  "South of Market": "moderate",
  "Pacific Heights": "moderate",
  "Western Addition": "moderate",
  "Hayes Valley": "moderate",
  Excelsior: "low",
  Bayview: "low",
  "Bayview Hunters Point": "low",
};

type LayerProvenance = { source_url: string; source_label: string; ingested_at: string };

const sourceFromManifest = async (layerId: string, fallback: LayerProvenance): Promise<LayerProvenance> => {
  try {
    const m = await import("./data-source").then((d) => d.loadManifest());
    const e = m.find((x) => x.layerId === layerId);
    if (e) return { source_url: e.source_url, source_label: e.source_label, ingested_at: e.ingested_at };
  } catch {
    /* fall through */
  }
  return fallback;
};

function findNeighborhood(
  lat: number,
  lng: number,
  fc: FeatureCollection<Polygon | MultiPolygon, { nhood?: string }>,
): string | undefined {
  for (const f of fc.features) {
    if (pointInPolygon(lng, lat, f.geometry)) return f.properties?.nhood;
  }
  return undefined;
}

// Helper to build a Concern with the right severity for this horizon.
function mkConcern(args: {
  id: string;
  layer: LayerId;
  key: SeverityKey;
  horizon: Horizon;
  title: string;
  body: string;
  action?: string;
  source: { label: string; url: string };
  ingested_at: string;
  meta?: Record<string, unknown>;
}): Concern {
  return {
    id: args.id,
    layer: args.layer,
    severity: severityFor(args.key, args.horizon),
    title: args.title,
    body: args.body,
    ...(args.action ? { action: args.action } : {}),
    source: args.source,
    ingested_at: args.ingested_at,
    ...(args.meta ? { meta: args.meta } : {}),
  };
}

// Hash a concern array for cache invalidation. Stable across runs.
function hashConcerns(cs: Concern[]): string {
  const fingerprint = cs
    .map((c) => `${c.id}|${c.severity}|${c.title}`)
    .sort()
    .join("\n");
  return `sha1:${createHash("sha1").update(fingerprint).digest("hex")}`;
}

// Box query for points: returns features within `radiusM` meters of (lat,lng).
function pointsWithin(lat: number, lng: number, radiusM: number, fc: FeatureCollection): Feature[] {
  const hits: Feature[] = [];
  // Bounding-box prefilter for speed (constant lat/lng deg → m).
  const dLat = radiusM / 110_540;
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  for (const f of fc.features) {
    if (f.geometry.type !== "Point") continue;
    const [plng, plat] = f.geometry.coordinates;
    if (!Number.isFinite(plat) || !Number.isFinite(plng)) continue;
    if (Math.abs(plat! - lat) > dLat || Math.abs(plng! - lng) > dLng) continue;
    if (haversineMeters(lat, lng, plat!, plng!) <= radiusM) hits.push(f);
  }
  return hits;
}

export async function concernsAt(
  lat: number,
  lng: number,
  horizon: Horizon,
): Promise<{ address: Address; horizon: Horizon; concerns: Concern[]; concerns_hash: string }> {
  if (!isInSF(lat, lng)) {
    return {
      address: { lat, lng },
      horizon,
      concerns: [],
      concerns_hash: "sha1:empty",
    };
  }

  const concerns: Concern[] = [];

  // ----- Neighborhoods (also used to label the address)
  const nhoods = await maybeLoad("neighborhoods.geojson");
  const neighborhood = nhoods
    ? findNeighborhood(lat, lng, nhoods as FeatureCollection<Polygon | MultiPolygon, { nhood?: string }>)
    : undefined;
  const address: Address = { lat, lng, neighborhood };

  // ============================================================
  // Layer 1+2: Seismic — liquefaction & faults
  // ============================================================
  const liq = await maybeLoad("seismic_liquefaction.geojson");
  if (liq) {
    const inLiq = liq.features.some(
      (f) =>
        (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") &&
        pointInPolygon(lng, lat, f.geometry as Polygon | MultiPolygon),
    );
    const src = await sourceFromManifest("seismic_liquefaction", {
      source_label: "California Geological Survey Seismic Hazard Zones",
      source_url: "https://maps.conservation.ca.gov/cgs/informationwarehouse/eqzapp/",
      ingested_at: new Date().toISOString(),
    });
    concerns.push(
      inLiq
        ? mkConcern({
            id: `liquefaction_in_${lat.toFixed(4)}_${lng.toFixed(4)}`,
            layer: "seismic_liquefaction",
            key: "liquefaction.in_zone",
            horizon,
            title: "Inside CGS regulatory liquefaction zone",
            body: "This parcel is within the California Geological Survey's regulatory liquefaction hazard zone. In a major event the soil column can lose strength and amplify shaking on weak fill or saturated alluvium.",
            action: "Require a parcel-specific geotechnical report from the seller; insurers will ask.",
            source: { label: src.source_label, url: src.source_url },
            ingested_at: src.ingested_at,
          })
        : mkConcern({
            id: `liquefaction_out_${lat.toFixed(4)}_${lng.toFixed(4)}`,
            layer: "seismic_liquefaction",
            key: "softstory.tract_density_high", // mapped to "watch" baseline; downgrade to context
            horizon,
            title: "Outside CGS regulatory liquefaction zone",
            body: "Outside the regulatory map. This is the better side of the seismic substrate question — but ask the seller for the geotechnical disclosure anyway.",
            source: { label: src.source_label, url: src.source_url },
            ingested_at: src.ingested_at,
          }),
    );
    // Force the "outside" concern down to favor context manually.
    if (!inLiq) concerns[concerns.length - 1]!.severity = "favor";
  }

  // ============================================================
  // Layer 3: Soft-story (neighborhood-density tier)
  // ============================================================
  if (neighborhood) {
    const tier = SOFTSTORY_TIERS[neighborhood];
    if (tier === "high" || tier === "moderate") {
      concerns.push(
        mkConcern({
          id: `softstory_${neighborhood.replace(/\W+/g, "_")}_${tier}`,
          layer: "seismic_softstory",
          key: tier === "high" ? "softstory.tract_density_high" : "softstory.tract_density_high",
          horizon,
          title: `${tier === "high" ? "High" : "Moderate"} soft-story density nearby`,
          body: `${neighborhood} has ${tier} surrounding stock of pre-1978 wood-frame multi-unit buildings vulnerable to soft-story collapse. The neighborhood signal does not tell you anything about a specific building's retrofit status.`,
          action:
            "For the specific address, verify retrofit status in DataSF's Soft-Story Properties database before bidding.",
          source: {
            label: "DataSF — Soft-Story Properties",
            url: "https://data.sfgov.org/Housing-and-Buildings/Map-of-Soft-Story-Properties/jwdp-cqyc",
          },
          ingested_at: new Date().toISOString(),
        }),
      );
      if (tier === "moderate") concerns[concerns.length - 1]!.severity = "watch";
    }
  }

  // ============================================================
  // Layer 4-6: Flood (FEMA SFHA / SLR / pluvial)
  // ============================================================
  const flood = await maybeLoad("flood_fema.geojson");
  if (flood) {
    let hit: { name: string; sev: string } | null = null;
    for (const f of flood.features) {
      if (f.geometry.type !== "Polygon" && f.geometry.type !== "MultiPolygon") continue;
      if (pointInPolygon(lng, lat, f.geometry as Polygon | MultiPolygon)) {
        const p = (f.properties ?? {}) as { name?: string; severity?: string; zone?: string };
        hit = { name: p.name ?? "Flood zone", sev: p.severity ?? "moderate" };
        break;
      }
    }
    const src = await sourceFromManifest("flood_fema", {
      source_label: "FEMA NFHL + SF Planning Combined Flood Map",
      source_url: "https://msc.fema.gov/portal/search",
      ingested_at: new Date().toISOString(),
    });
    if (hit) {
      concerns.push(
        mkConcern({
          id: `flood_in_${hit.name.replace(/\W+/g, "_")}`,
          layer: "flood_fema",
          key: "flood.fema_sfha",
          horizon,
          title: `Inside flood / sea-level-rise zone: ${hit.name}`,
          body: "This parcel sits in a known flood or coastal-fill exposure area. Combined FEMA + NOAA + SF Planning sources flag it.",
          action:
            "Price in flood insurance and ask the seller for elevation certificate; verify directly on FEMA MSC.",
          source: { label: src.source_label, url: src.source_url },
          ingested_at: src.ingested_at,
        }),
      );
    } else {
      concerns.push(
        mkConcern({
          id: `flood_out_${lat.toFixed(4)}_${lng.toFixed(4)}`,
          layer: "flood_fema",
          key: "flood.fema_x_outside",
          horizon,
          title: "Outside FEMA SFHA",
          body: "Not in a Special Flood Hazard Area or known coastal/pluvial exposure polygon. Standard hazard insurance suffices.",
          source: { label: src.source_label, url: src.source_url },
          ingested_at: src.ingested_at,
        }),
      );
    }
  }

  // ============================================================
  // Layer 7: Family Zoning Plan upzoning corridors
  // ============================================================
  const upzone = await maybeLoad("zoning_upzone.geojson");
  if (upzone) {
    let nearest: { name: string; dist: number; height: number } | null = null;
    for (const f of upzone.features) {
      if (f.geometry.type !== "LineString") continue;
      const d = distanceToLineStringMeters(lat, lng, f.geometry as LineString);
      const p = (f.properties ?? {}) as { name?: string; max_height_ft?: number };
      if (!nearest || d < nearest.dist) {
        nearest = { name: p.name ?? "Upzoned corridor", dist: d, height: p.max_height_ft ?? 0 };
      }
    }
    if (nearest) {
      const src = await sourceFromManifest("zoning_upzone", {
        source_label: "SF Planning — SF Family Zoning Plan",
        source_url: "https://sfplanning.org/sf-family-zoning-plan",
        ingested_at: new Date().toISOString(),
      });
      if (nearest.dist < 75) {
        concerns.push(
          mkConcern({
            id: `upzone_fronting_${nearest.name.replace(/\W+/g, "_")}`,
            layer: "zoning_upzone",
            key: "upzone.fronting",
            horizon,
            title: `Fronting the ${nearest.name} upzoned corridor`,
            body: `~${Math.round(nearest.dist)} m from a corridor with a maximum height of ${nearest.height} ft under the SF Family Zoning Plan. Expect taller construction directly on the frontage over the planning horizon.`,
            action:
              "If the home's view, light, or noise environment depends on the current frontage, factor in adjacent redevelopment.",
            source: { label: src.source_label, url: src.source_url },
            ingested_at: src.ingested_at,
            meta: { distance_m: Math.round(nearest.dist), max_height_ft: nearest.height },
          }),
        );
      } else if (nearest.dist < 200) {
        concerns.push(
          mkConcern({
            id: `upzone_near_${nearest.name.replace(/\W+/g, "_")}`,
            layer: "zoning_upzone",
            key: "upzone.within_200m",
            horizon,
            title: `Near the ${nearest.name} upzoned corridor`,
            body: `~${Math.round(nearest.dist)} m from a corridor with a maximum height of ${nearest.height} ft. Construction along the corridor will be visible from this block.`,
            source: { label: src.source_label, url: src.source_url },
            ingested_at: src.ingested_at,
            meta: { distance_m: Math.round(nearest.dist), max_height_ft: nearest.height },
          }),
        );
      }
    }
  }

  // ============================================================
  // Layer 8: DBI building permits — active construction within 500 ft
  // ============================================================
  const permits = await maybeLoad("construction_permits.geojson");
  if (permits) {
    const FT_500 = 152.4; // 500 ft
    const hits = pointsWithin(lat, lng, FT_500, permits);
    const active = hits.filter((f) => {
      const p = (f.properties ?? {}) as { status?: string; type?: string };
      return (p.status ?? "").toLowerCase().match(/issued|approved|active|reinstated/);
    });
    if (active.length > 0) {
      const src = await sourceFromManifest("construction_permits", {
        source_label: "DataSF — DBI Building Permits",
        source_url: "https://data.sfgov.org/Housing-and-Buildings/Building-Permits/i98e-djp9",
        ingested_at: new Date().toISOString(),
      });
      concerns.push(
        mkConcern({
          id: `permits_active_${lat.toFixed(4)}_${lng.toFixed(4)}`,
          layer: "construction_permits",
          key: "construction.permit_within_500ft.active",
          horizon,
          title: `${active.length} active construction permit${active.length === 1 ? "" : "s"} within 500 ft`,
          body:
            active.length > 1
              ? "Multiple parcels nearby have active or recently issued DBI permits. Expect ongoing construction noise and street disruption."
              : "One nearby parcel has an active or recently issued DBI permit.",
          action: "Drive by on a weekday morning to gauge actual disruption.",
          source: { label: src.source_label, url: src.source_url },
          ingested_at: src.ingested_at,
          meta: { count: active.length },
        }),
      );
    }
  }

  // ============================================================
  // Layer 11: Vision Zero High Injury Network
  // ============================================================
  const hin = await maybeLoad("safety_hin.geojson");
  if (hin) {
    let minD = Number.POSITIVE_INFINITY;
    for (const f of hin.features) {
      if (f.geometry.type === "LineString") {
        const d = distanceToLineStringMeters(lat, lng, f.geometry);
        if (d < minD) minD = d;
      } else if (f.geometry.type === "MultiLineString") {
        for (const line of f.geometry.coordinates) {
          const d = distanceToLineStringMeters(lat, lng, { type: "LineString", coordinates: line });
          if (d < minD) minD = d;
        }
      }
    }
    if (minD < 100) {
      const src = await sourceFromManifest("safety_hin", {
        source_label: "DataSF — 2024 High Injury Network",
        source_url: "https://data.sfgov.org/Transportation/2024-High-Injury-Network/enwt-3u8m",
        ingested_at: new Date().toISOString(),
      });
      concerns.push(
        mkConcern({
          id: `hin_near_${lat.toFixed(4)}_${lng.toFixed(4)}`,
          layer: "safety_hin",
          key: "safety.hin_within_100m",
          horizon,
          title: "On or near a Vision Zero High Injury corridor",
          body: `~${Math.round(minD)} m from a street segment that accounts for the city's heaviest concentration of severe-injury and fatal collisions. Pedestrian and cyclist exposure here is materially elevated.`,
          action: "Plan walking routes to avoid this corridor, especially at dusk.",
          source: { label: src.source_label, url: src.source_url },
          ingested_at: src.ingested_at,
          meta: { distance_m: Math.round(minD) },
        }),
      );
    }
  }

  // ============================================================
  // Layer 12: SFPD incidents — density within 250m, last 12 mo
  // ============================================================
  const crime = await maybeLoad("safety_crime.geojson");
  if (crime) {
    const hits = pointsWithin(lat, lng, 250, crime);
    if (hits.length > 0) {
      const src = await sourceFromManifest("safety_crime", {
        source_label: "DataSF — SFPD Incident Reports (rolling 365 d)",
        source_url:
          "https://data.sfgov.org/Public-Safety/Police-Department-Incident-Reports-2018-to-Present/wg3w-h783",
        ingested_at: new Date().toISOString(),
      });
      // Threshold: > 200 incidents in a 250m radius / 365 d → "high"; < 50 → "low".
      const isHigh = hits.length > 200;
      const isLow = hits.length < 50;
      concerns.push(
        mkConcern({
          id: `crime_density_${lat.toFixed(4)}_${lng.toFixed(4)}`,
          layer: "safety_crime",
          key: isHigh ? "safety.crime_high_density" : "safety.crime_low_density",
          horizon,
          title: isHigh
            ? `Elevated incident density (${hits.length} reports / 250 m / 12 mo)`
            : isLow
              ? `Low incident density (${hits.length} reports / 250 m / 12 mo)`
              : `Typical incident density (${hits.length} reports / 250 m / 12 mo)`,
          body: isHigh
            ? "SFPD incident reports indicate above-typical density nearby. Most categories are property crime — verify by category before drawing conclusions."
            : isLow
              ? "SFPD incident density is below the SF average for a 250 m circle over the last 12 months."
              : "SFPD incident density is around the SF average for a 250 m circle over the last 12 months.",
          source: { label: src.source_label, url: src.source_url },
          ingested_at: src.ingested_at,
          meta: { incidents_within_250m_12mo: hits.length },
        }),
      );
      if (!isHigh && !isLow) concerns[concerns.length - 1]!.severity = "context";
    }
  }

  // ============================================================
  // Layer 13: Schools — nearest with rating ≥ 8 within 1200m (favor)
  // ============================================================
  const schools = await maybeLoad("schools.geojson");
  if (schools) {
    type S = { name: string; rating: number | null; level: string };
    const ranked: { name: string; rating: number; dist: number; level: string }[] = [];
    for (const f of schools.features) {
      if (f.geometry.type !== "Point") continue;
      const p = (f.properties ?? {}) as S;
      const [slng, slat] = f.geometry.coordinates;
      if (!Number.isFinite(slat) || !Number.isFinite(slng)) continue;
      const d = haversineMeters(lat, lng, slat!, slng!);
      ranked.push({ name: p.name, rating: p.rating ?? 0, dist: d, level: p.level });
    }
    ranked.sort((a, b) => a.dist - b.dist);
    const goodNear = ranked.find((s) => s.rating >= 8 && s.dist < 1200);
    const src = await sourceFromManifest("schools", {
      source_label: "SFUSD school directory + GreatSchools ratings (manual)",
      source_url: "https://www.sfusd.edu/schools",
      ingested_at: new Date().toISOString(),
    });
    if (goodNear) {
      concerns.push(
        mkConcern({
          id: `schools_high_near_${goodNear.name.replace(/\W+/g, "_")}`,
          layer: "schools",
          key: "school.high_rated_within_1200m",
          horizon,
          title: `Strong-rated school within walking distance: ${goodNear.name}`,
          body: `${goodNear.name} (${goodNear.level}, ${goodNear.rating}/10) is ~${Math.round(goodNear.dist)} m away.`,
          source: { label: src.source_label, url: src.source_url },
          ingested_at: src.ingested_at,
          meta: { name: goodNear.name, rating: goodNear.rating, distance_m: Math.round(goodNear.dist) },
        }),
      );
    } else if (ranked[0]) {
      concerns.push(
        mkConcern({
          id: `schools_nearest_${ranked[0].name.replace(/\W+/g, "_")}`,
          layer: "schools",
          key: "school.no_high_rated_within_1200m",
          horizon,
          title: `Nearest school: ${ranked[0].name}`,
          body: `${ranked[0].name} (${ranked[0].level}${ranked[0].rating ? `, ${ranked[0].rating}/10` : ""}) is ~${Math.round(ranked[0].dist)} m away. SF lottery means physical proximity is only one factor.`,
          source: { label: src.source_label, url: src.source_url },
          ingested_at: src.ingested_at,
          meta: { name: ranked[0].name, rating: ranked[0].rating, distance_m: Math.round(ranked[0].dist) },
        }),
      );
    }
  }

  // ============================================================
  // Layer 14: Transit — BART within 800m / Muni Metro within 400m
  // ============================================================
  const bart = await maybeLoad("transit_bart.geojson");
  const muni = await maybeLoad("transit_muni_metro.geojson");
  const bartNearest = bart ? nearestPointFC(lat, lng, bart) : null;
  const muniNearest = muni ? nearestPointFC(lat, lng, muni) : null;

  const transitSrc = {
    source_label: "BART Stations API + SFMTA Muni Metro",
    source_url: "https://www.bart.gov/stations",
    ingested_at: new Date().toISOString(),
  };
  if (muniNearest && muniNearest.dist < 400) {
    concerns.push(
      mkConcern({
        id: `transit_muni_${muniNearest.name.replace(/\W+/g, "_")}`,
        layer: "transit",
        key: "transit.muni_metro_within_400m",
        horizon,
        title: `Muni Metro stop within walking distance: ${muniNearest.name}`,
        body: `~${Math.round(muniNearest.dist)} m to ${muniNearest.name}.`,
        source: { label: transitSrc.source_label, url: transitSrc.source_url },
        ingested_at: transitSrc.ingested_at,
      }),
    );
  }
  if (bartNearest && bartNearest.dist < 800) {
    concerns.push(
      mkConcern({
        id: `transit_bart_${bartNearest.name.replace(/\W+/g, "_")}`,
        layer: "transit",
        key: "transit.bart_within_800m",
        horizon,
        title: `BART within walking distance: ${bartNearest.name}`,
        body: `~${Math.round(bartNearest.dist)} m to ${bartNearest.name} BART.`,
        source: { label: transitSrc.source_label, url: transitSrc.source_url },
        ingested_at: transitSrc.ingested_at,
      }),
    );
  } else if ((!bartNearest || bartNearest.dist > 1600) && (!muniNearest || muniNearest.dist > 800)) {
    concerns.push(
      mkConcern({
        id: `transit_thin_${lat.toFixed(4)}_${lng.toFixed(4)}`,
        layer: "transit",
        key: "transit.no_rapid_within_1600m",
        horizon,
        title: "Thin rapid-transit coverage",
        body: `Nearest Muni Metro: ${muniNearest ? `${muniNearest.name} ~${Math.round(muniNearest.dist)} m` : "n/a"}; nearest BART: ${bartNearest ? `${bartNearest.name} ~${Math.round(bartNearest.dist)} m` : "n/a"}.`,
        action: "If rail-grade transit matters, plan around bus routes; check Muni rapid bus options.",
        source: { label: transitSrc.source_label, url: transitSrc.source_url },
        ingested_at: transitSrc.ingested_at,
      }),
    );
  }

  // ============================================================
  // Layer 16: Microclimate (fog) — west of fog band → context
  // ============================================================
  const fog = await maybeLoad("climate_fog.geojson");
  if (fog) {
    let inFog = false;
    let tier: string | undefined;
    for (const f of fog.features) {
      if (f.geometry.type !== "Polygon") continue;
      if (pointInPolygon(lng, lat, f.geometry)) {
        inFog = true;
        tier = (f.properties as { tier?: string })?.tier;
        break;
      }
    }
    if (inFog && tier && tier !== "east") {
      concerns.push(
        mkConcern({
          id: `fog_${tier}_${lat.toFixed(4)}_${lng.toFixed(4)}`,
          layer: "climate_fog",
          key: "climate.fog_belt_west",
          horizon,
          title: `In the ${tier} fog band`,
          body: "West-side microclimate. Summers are markedly cooler and foggier than the eastern half of the city.",
          source: {
            label: "UC Berkeley Microclimate (Dawson Lab)",
            url: "https://nature.berkeley.edu/dawsonlab/Welcome.html",
          },
          ingested_at: new Date().toISOString(),
        }),
      );
    }
  }

  // ============================================================
  // Layer 20: Tree canopy (count within 100m as proxy)
  // ============================================================
  const trees = await maybeLoad("quality_trees.geojson");
  if (trees) {
    const nearbyTrees = pointsWithin(lat, lng, 100, trees);
    if (nearbyTrees.length >= 30) {
      concerns.push(
        mkConcern({
          id: `trees_high_${lat.toFixed(4)}_${lng.toFixed(4)}`,
          layer: "quality_trees",
          key: "quality.tree_canopy_high",
          horizon,
          title: `Strong tree canopy nearby (${nearbyTrees.length} street trees / 100 m)`,
          body: "Above-typical density of catalogued street trees within a one-block radius — consistent with leafier blocks and slightly cooler summer surface temperatures.",
          source: {
            label: "DataSF — Street Tree List",
            url: "https://data.sfgov.org/City-Infrastructure/Street-Tree-List/tkzw-k3nq",
          },
          ingested_at: new Date().toISOString(),
        }),
      );
    } else if (nearbyTrees.length < 5) {
      concerns.push(
        mkConcern({
          id: `trees_low_${lat.toFixed(4)}_${lng.toFixed(4)}`,
          layer: "quality_trees",
          key: "quality.tree_canopy_low",
          horizon,
          title: `Sparse street trees (${nearbyTrees.length} within 100 m)`,
          body: "Catalogued street-tree density here is low. Expect a more exposed sidewalk environment.",
          source: {
            label: "DataSF — Street Tree List",
            url: "https://data.sfgov.org/City-Infrastructure/Street-Tree-List/tkzw-k3nq",
          },
          ingested_at: new Date().toISOString(),
        }),
      );
    }
  }

  // Sort: alerts first, then watch, then favor, then context.
  const order = { alert: 0, watch: 1, favor: 2, context: 3 } as const;
  concerns.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    address,
    horizon,
    concerns,
    concerns_hash: hashConcerns(concerns),
  };
}

function nearestPointFC(
  lat: number,
  lng: number,
  fc: FeatureCollection,
): { name: string; dist: number; lat: number; lng: number } | null {
  let best: { name: string; dist: number; lat: number; lng: number } | null = null;
  for (const f of fc.features) {
    if (f.geometry.type !== "Point") continue;
    const [plng, plat] = f.geometry.coordinates;
    if (!Number.isFinite(plat) || !Number.isFinite(plng)) continue;
    const d = haversineMeters(lat, lng, plat!, plng!);
    if (!best || d < best.dist) {
      const name = ((f.properties ?? {}) as { name?: string }).name ?? "stop";
      best = { name, dist: d, lat: plat!, lng: plng! };
    }
  }
  return best;
}
