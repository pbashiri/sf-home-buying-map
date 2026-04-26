// Authoritative concern type. The LLM never invents claims; it only summarizes
// the structured concerns array produced by the spatial query layer.
// See SPEC.md §3.

import { z } from "zod";

export const SeverityZ = z.enum(["alert", "watch", "favor", "context"]);
export type Severity = z.infer<typeof SeverityZ>;

export const HorizonZ = z.union([z.literal(5), z.literal(7), z.literal(10), z.literal(15)]);
export type Horizon = z.infer<typeof HorizonZ>;

export const LayerIdZ = z.enum([
  "seismic_liquefaction",
  "seismic_fault",
  "seismic_softstory",
  "flood_fema",
  "flood_slr",
  "flood_pluvial",
  "zoning_upzone",
  "construction_permits",
  "construction_pipeline",
  "legal_historic",
  "safety_hin",
  "safety_crime",
  "schools",
  "transit",
  "noise_aircraft",
  "climate_fog",
  "health_air",
  "property_assessor",
  "property_complaints",
  "quality_trees",
]);
export type LayerId = z.infer<typeof LayerIdZ>;

export const ConcernSourceZ = z.object({
  label: z.string(),
  url: z.string().url(),
});

export const ConcernZ = z.object({
  id: z.string(),
  layer: LayerIdZ,
  severity: SeverityZ,
  title: z.string(),
  body: z.string(),
  action: z.string().optional(),
  source: ConcernSourceZ,
  ingested_at: z.string(),
  // Free-form structured data — the LLM may use this in prose.
  meta: z.record(z.unknown()).optional(),
});
export type Concern = z.infer<typeof ConcernZ>;

export const AddressZ = z.object({
  lat: z.number(),
  lng: z.number(),
  formatted: z.string().optional(),
  neighborhood: z.string().optional(),
  zip: z.string().optional(),
});
export type Address = z.infer<typeof AddressZ>;

export const ConcernsResponseZ = z.object({
  address: AddressZ,
  horizon: HorizonZ,
  concerns: z.array(ConcernZ),
  concerns_hash: z.string(),
});
export type ConcernsResponse = z.infer<typeof ConcernsResponseZ>;

export const SummaryBulletZ = z.object({
  severity: SeverityZ,
  concern_id: z.string(),
  text: z.string(),
});
export type SummaryBullet = z.infer<typeof SummaryBulletZ>;

export const SummaryZ = z.object({
  headline: z.string(),
  bullets: z.array(SummaryBulletZ),
  outlook: z.string(),
  verdict: z.enum(["alert", "watch", "neutral", "favor"]),
});
export type Summary = z.infer<typeof SummaryZ>;
