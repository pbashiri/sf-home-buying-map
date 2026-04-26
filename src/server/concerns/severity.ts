// SEVERITY_BY_HORIZON tables — SPEC §3.3.
// The horizon weights "how to weight severity by time-relevance".
// Tweaking these is a normal PR. Add a row, write a test in tests/unit/severity.test.ts.

import type { Horizon, Severity } from "@/types/concern";

export type SeverityKey =
  // seismic
  | "liquefaction.in_zone"
  | "fault.within_50m"
  | "softstory.within_block"
  | "softstory.tract_density_high"
  // flood
  | "flood.fema_sfha"
  | "flood.fema_x_outside"
  | "flood.slr_1ft"
  | "flood.slr_3ft"
  | "flood.slr_6ft"
  | "flood.pluvial_zone"
  // zoning / construction
  | "upzone.fronting"
  | "upzone.within_200m"
  | "upzone.in_decontrol"
  | "construction.permit_within_500ft.active"
  | "construction.pipeline_within_500ft.entitled"
  | "legal.historic_district"
  // safety / quality
  | "safety.hin_within_100m"
  | "safety.crime_high_density"
  | "safety.crime_low_density"
  // schools / transit
  | "school.high_rated_within_1200m"
  | "school.no_high_rated_within_1200m"
  | "transit.bart_within_800m"
  | "transit.muni_metro_within_400m"
  | "transit.no_rapid_within_1600m"
  // climate / health
  | "climate.fog_belt_west"
  | "noise.aircraft_65db"
  | "air.bay_area_purple"
  // property
  | "property.dbi_complaints_active"
  | "property.last_sale_recent"
  | "quality.tree_canopy_high"
  | "quality.tree_canopy_low";

const T = (s5: Severity, s10: Severity, s15: Severity): Record<Horizon, Severity> => ({
  5: s5,
  7: s5,
  10: s10,
  15: s15,
});

export const SEVERITY_BY_HORIZON: Record<SeverityKey, Record<Horizon, Severity>> = {
  // Seismic
  "liquefaction.in_zone": T("alert", "alert", "alert"),
  "fault.within_50m": T("alert", "alert", "alert"),
  "softstory.within_block": T("alert", "alert", "alert"),
  "softstory.tract_density_high": T("watch", "watch", "watch"),

  // Flood
  "flood.fema_sfha": T("alert", "alert", "alert"),
  "flood.fema_x_outside": T("favor", "favor", "favor"),
  "flood.slr_1ft": T("watch", "alert", "alert"),
  "flood.slr_3ft": T("context", "watch", "alert"),
  "flood.slr_6ft": T("context", "context", "watch"),
  "flood.pluvial_zone": T("watch", "watch", "alert"),

  // Zoning / construction
  "upzone.fronting": T("alert", "alert", "alert"),
  "upzone.within_200m": T("watch", "alert", "alert"),
  "upzone.in_decontrol": T("watch", "watch", "alert"),
  "construction.permit_within_500ft.active": T("alert", "watch", "context"),
  "construction.pipeline_within_500ft.entitled": T("watch", "alert", "alert"),
  "legal.historic_district": T("context", "context", "context"),

  // Safety
  "safety.hin_within_100m": T("watch", "watch", "watch"),
  "safety.crime_high_density": T("watch", "watch", "watch"),
  "safety.crime_low_density": T("favor", "favor", "favor"),

  // Schools / transit
  "school.high_rated_within_1200m": T("favor", "favor", "favor"),
  "school.no_high_rated_within_1200m": T("context", "context", "context"),
  "transit.bart_within_800m": T("favor", "favor", "favor"),
  "transit.muni_metro_within_400m": T("favor", "favor", "favor"),
  "transit.no_rapid_within_1600m": T("watch", "watch", "watch"),

  // Climate / health
  "climate.fog_belt_west": T("context", "context", "context"),
  "noise.aircraft_65db": T("watch", "watch", "alert"),
  "air.bay_area_purple": T("context", "context", "context"),

  // Property
  "property.dbi_complaints_active": T("watch", "watch", "context"),
  "property.last_sale_recent": T("context", "context", "context"),
  "quality.tree_canopy_high": T("favor", "favor", "favor"),
  "quality.tree_canopy_low": T("context", "context", "context"),
};

export function severityFor(key: SeverityKey, horizon: Horizon): Severity {
  return SEVERITY_BY_HORIZON[key][horizon];
}
