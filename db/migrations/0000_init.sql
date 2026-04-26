-- Initial schema for theami v1 (SPEC §2.2)
-- Run after enabling extensions:
--   CREATE EXTENSION IF NOT EXISTS postgis;
--   CREATE EXTENSION IF NOT EXISTS pgcrypto;
--   CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS neighborhoods (
  id           serial PRIMARY KEY,
  name         text NOT NULL,
  slug         text NOT NULL UNIQUE,
  geom         geometry(MultiPolygon, 4326) NOT NULL,
  source_url   text,
  ingested_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS neighborhoods_geom_gist ON neighborhoods USING gist(geom);

CREATE TABLE IF NOT EXISTS hazard_zones (
  id           serial PRIMARY KEY,
  layer_id     text NOT NULL,
  severity     text NOT NULL,
  name         text,
  properties   jsonb,
  geom         geometry(Geometry, 4326) NOT NULL,
  source_url   text,
  source_id    text,
  ingested_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hazard_zones_geom_gist ON hazard_zones USING gist(geom);
CREATE INDEX IF NOT EXISTS hazard_zones_layer_id ON hazard_zones (layer_id);
CREATE INDEX IF NOT EXISTS hazard_zones_ingested_brin ON hazard_zones USING brin(ingested_at);

CREATE TABLE IF NOT EXISTS hin_corridors (
  id           serial PRIMARY KEY,
  name         text,
  geom         geometry(MultiLineString, 4326) NOT NULL,
  ingested_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hin_corridors_geom_gist ON hin_corridors USING gist(geom);

CREATE TABLE IF NOT EXISTS upzoned_corridors (
  id              serial PRIMARY KEY,
  name            text NOT NULL,
  max_height_ft   integer,
  effective_date  text,
  geom            geometry(MultiLineString, 4326) NOT NULL,
  ingested_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS upzoned_corridors_geom_gist ON upzoned_corridors USING gist(geom);

CREATE TABLE IF NOT EXISTS historic_districts (
  id           serial PRIMARY KEY,
  name         text NOT NULL,
  article      integer,
  geom         geometry(MultiPolygon, 4326) NOT NULL,
  ingested_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS historic_districts_geom_gist ON historic_districts USING gist(geom);

CREATE TABLE IF NOT EXISTS building_permits (
  id              text PRIMARY KEY,
  parcel          text,
  status          text,
  work_class      text,
  description     text,
  geom            geometry(Point, 4326) NOT NULL,
  filed_at        timestamptz,
  last_action_at  timestamptz,
  ingested_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS building_permits_geom_gist ON building_permits USING gist(geom);
CREATE INDEX IF NOT EXISTS building_permits_filed_brin ON building_permits USING brin(filed_at);

CREATE TABLE IF NOT EXISTS schools (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  rating       integer,
  level        text,
  geom         geometry(Point, 4326) NOT NULL,
  lottery_url  text,
  ingested_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS schools_geom_gist ON schools USING gist(geom);

CREATE TABLE IF NOT EXISTS transit_stops (
  id           text PRIMARY KEY,
  system       text NOT NULL,
  name         text NOT NULL,
  lines        text[],
  geom         geometry(Point, 4326) NOT NULL,
  ingested_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS transit_stops_geom_gist ON transit_stops USING gist(geom);

CREATE TABLE IF NOT EXISTS crime_incidents (
  id           text PRIMARY KEY,
  category     text,
  description  text,
  geom         geometry(Point, 4326) NOT NULL,
  occurred_at  timestamptz NOT NULL,
  ingested_at  timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (occurred_at);
CREATE INDEX IF NOT EXISTS crime_incidents_geom_gist ON crime_incidents USING gist(geom);
CREATE INDEX IF NOT EXISTS crime_incidents_occurred_brin ON crime_incidents USING brin(occurred_at);

CREATE TABLE IF NOT EXISTS parcels (
  apn               text PRIMARY KEY,
  address           text,
  geom              geometry(MultiPolygon, 4326) NOT NULL,
  year_built        integer,
  beds              integer,
  baths             integer,
  sqft              integer,
  last_sale_price   bigint,
  last_sale_date    timestamptz,
  ingested_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS parcels_geom_gist ON parcels USING gist(geom);
CREATE INDEX IF NOT EXISTS parcels_address_idx ON parcels (address);
CREATE INDEX IF NOT EXISTS parcels_address_trgm ON parcels USING gin (address gin_trgm_ops);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source       text NOT NULL,
  started_at   timestamptz NOT NULL DEFAULT now(),
  ended_at     timestamptz,
  rows_added   integer,
  rows_updated integer,
  status       text NOT NULL,
  error        text
);
