// Drizzle schema for v1. Mirrors SPEC §2.2.
//
// Note: PostGIS geometry columns are typed as `customType` blobs because
// drizzle-orm doesn't ship native PostGIS support yet. The migrations include
// raw SQL to create the columns, the GIST indexes, and a few helpers.

import { sql } from "drizzle-orm";
import {
  bigint,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const geometry = customType<{ data: unknown; driverData: string }>({
  dataType: () => "geometry",
});

export const neighborhoods = pgTable(
  "neighborhoods",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    geom: geometry("geom").notNull(),
    sourceUrl: text("source_url"),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    geomIdx: index("neighborhoods_geom_gist").using("gist", t.geom),
  }),
);

export const hazardZones = pgTable(
  "hazard_zones",
  {
    id: serial("id").primaryKey(),
    layerId: text("layer_id").notNull(),
    severity: text("severity").notNull(),
    name: text("name"),
    properties: jsonb("properties"),
    geom: geometry("geom").notNull(),
    sourceUrl: text("source_url"),
    sourceId: text("source_id"),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    geomIdx: index("hazard_zones_geom_gist").using("gist", t.geom),
    layerIdx: index("hazard_zones_layer_id").on(t.layerId),
  }),
);

export const hinCorridors = pgTable(
  "hin_corridors",
  {
    id: serial("id").primaryKey(),
    name: text("name"),
    geom: geometry("geom").notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    geomIdx: index("hin_corridors_geom_gist").using("gist", t.geom),
  }),
);

export const upzonedCorridors = pgTable(
  "upzoned_corridors",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    maxHeightFt: integer("max_height_ft"),
    effectiveDate: text("effective_date"),
    geom: geometry("geom").notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    geomIdx: index("upzoned_corridors_geom_gist").using("gist", t.geom),
  }),
);

export const historicDistricts = pgTable(
  "historic_districts",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    article: integer("article"),
    geom: geometry("geom").notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    geomIdx: index("historic_districts_geom_gist").using("gist", t.geom),
  }),
);

export const buildingPermits = pgTable(
  "building_permits",
  {
    id: text("id").primaryKey(),
    parcel: text("parcel"),
    status: text("status"),
    workClass: text("work_class"),
    description: text("description"),
    geom: geometry("geom").notNull(),
    filedAt: timestamp("filed_at", { withTimezone: true }),
    lastActionAt: timestamp("last_action_at", { withTimezone: true }),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    geomIdx: index("building_permits_geom_gist").using("gist", t.geom),
    filedIdx: index("building_permits_filed_brin").using("brin", t.filedAt),
  }),
);

export const schools = pgTable(
  "schools",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    rating: integer("rating"),
    level: text("level"),
    geom: geometry("geom").notNull(),
    lotteryUrl: text("lottery_url"),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    geomIdx: index("schools_geom_gist").using("gist", t.geom),
  }),
);

export const transitStops = pgTable(
  "transit_stops",
  {
    id: text("id").primaryKey(),
    system: text("system").notNull(),
    name: text("name").notNull(),
    lines: text("lines").array(),
    geom: geometry("geom").notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    geomIdx: index("transit_stops_geom_gist").using("gist", t.geom),
  }),
);

export const crimeIncidents = pgTable(
  "crime_incidents",
  {
    id: text("id").primaryKey(),
    category: text("category"),
    description: text("description"),
    geom: geometry("geom").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    geomIdx: index("crime_incidents_geom_gist").using("gist", t.geom),
    occurredIdx: index("crime_incidents_occurred_brin").using("brin", t.occurredAt),
  }),
);

export const parcels = pgTable(
  "parcels",
  {
    apn: text("apn").primaryKey(),
    address: text("address"),
    geom: geometry("geom").notNull(),
    yearBuilt: integer("year_built"),
    beds: integer("beds"),
    baths: integer("baths"),
    sqft: integer("sqft"),
    lastSalePrice: bigint("last_sale_price", { mode: "number" }),
    lastSaleDate: timestamp("last_sale_date", { withTimezone: true }),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    geomIdx: index("parcels_geom_gist").using("gist", t.geom),
    addrIdx: index("parcels_address_idx").on(t.address),
  }),
);

export const ingestionRuns = pgTable("ingestion_runs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  source: text("source").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  rowsAdded: integer("rows_added"),
  rowsUpdated: integer("rows_updated"),
  status: text("status").notNull(),
  error: text("error"),
});
