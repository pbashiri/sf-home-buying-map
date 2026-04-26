# Decisions log

Per `SPEC.md` §0, "When this file and SPEC.md disagree, SPEC.md wins. Log any deviation in DECISIONS.md."

This file records the deviations and resolved-but-spec-silent choices made during the v1 build.

---

## D1 — Graceful degradation when API keys are missing

**Status:** chosen, structural.

**Spec position:** SPEC describes a stack assuming all keys are provisioned. It does not explicitly cover "what happens locally without keys."

**Decision:** Every external dependency falls back to a free, local equivalent when the corresponding env var is unset. Specifically:

| Service | Fallback | Drift from SPEC |
|---|---|---|
| Anthropic | Deterministic structured-summary stub (`deterministicSummary` in `src/server/llm/summarize.ts`). Same SSE schema, same cache keys. | None — production behaviour is identical when key set. |
| Google Places + Geocoding | Local SF gazetteer (40 neighborhoods + 321 Church) → Nominatim. | None — both flow through `src/app/api/places/*` and `src/app/api/geocode/*`. |
| MapTiler | OpenFreeMap "liberty" (CC-BY). | None — `src/components/map/map-style.ts` swaps URLs at runtime. |
| Supabase + PostGIS | Versioned GeoJSON in `public/data/`, read by `src/server/concerns/data-source.ts`. | Concern queries are in-process JS today; SPEC §2.2 PostGIS schema and migrations exist in `db/`. To swap, replace `data-source.ts`'s `loadFeatureCollection` with a Drizzle query. |
| Upstash Redis | In-process LRU. | None — `src/server/cache/index.ts` is the swap-point. |

**Rationale:** This lets the user run/dogfood the site immediately, and lets us ship "rollout-ready" code that flips to production behaviour purely by setting env vars in Vercel. No code changes required to flip.

---

## D2 — GreatSchools data: deferred for v1

**Status:** chosen.

**Spec position:** SPEC §11.6 — "no public free API. Decision needed before M2."

**Decision:** v1 ships with v0's curated SF schools list (15 schools, manually-synced GreatSchools ratings, April 2026). This is the conservative answer: no scraping, no paid API, no waiting on a vendor.

**Path forward:** when paid GreatSchools API is approved, swap `public/data/schools.geojson` for the API's output (the schema is already aligned: `name, lat, lng, rating, level`). The ingestion module skeleton lives at `src/server/ingest/`.

---

## D3 — Soft-story dataset is not point-queryable in v1

**Status:** known limitation, documented.

**Spec position:** SPEC §2.1 layer 3 cites DataSF `jwdp-cqyc`. The dataset's columns API currently returns empty objects (the public access surface appears to have been restricted or moved).

**Decision:** Soft-story is surfaced as a **neighborhood-density tier** rather than a per-parcel hit. SF's well-documented soft-story heatmap (Mission, North Beach, Marina, Castro/UM, Outer Richmond, etc.) is encoded in `SOFTSTORY_TIERS` in `src/server/concerns/index.ts`. The action item is unchanged — "verify retrofit status in DataSF" — and the source link still points at the canonical dataset page.

**Path forward:** when the parcel-level dataset becomes accessible (or we negotiate access), wire `src/server/ingest/datasf-softstory.ts` and remove the neighborhood heuristic.

---

## D4 — Historic districts ingestion deferred

**Status:** known limitation, documented.

**Spec position:** SPEC §2.1 layer 10 cites SF Planning ArcGIS for Article 10 / 11 districts.

**Decision:** No DataSF-mirror of this dataset returns a usable GeoJSON. Wiring SF Planning's ArcGIS REST endpoint requires query-string templating + WKT-to-GeoJSON conversion that's tractable but boilerplate-heavy.

**Path forward:** add `src/server/ingest/sfplanning-historic.ts` to do the ArcGIS query. The downstream concern layer is already plumbed (`legal_historic` in the severity table); the only missing piece is the data file.

---

## D5 — `LayerProvider` abstraction over PostGIS

**Status:** chosen, structural.

**Spec position:** SPEC §2.2 prescribes PostGIS + Drizzle. SPEC §8 prescribes the `src/server/concerns/index.ts` shape.

**Decision:** The concerns engine reads from versioned GeoJSON files via `src/server/concerns/data-source.ts`. Swapping to PostGIS is a **single-file change** — replace `loadFeatureCollection` with a Drizzle query that joins on `ST_Contains` / `ST_DWithin`. Existing callers don't move.

**Rationale:** Keeps the v1 build runnable without DB provisioning, while preserving the Drizzle schema (`db/schema.ts`) and migration (`db/migrations/0000_init.sql`) so the migration is mechanical when ready.

---

## D6 — Next.js 15 over 16

**Status:** chosen.

**Spec position:** SPEC §4 prescribes Next.js 15.

**Decision:** Honoring SPEC. Next.js 16 is GA as of April 2026 and largely backwards-compatible, but the SPEC explicitly names 15 and the build is on `15.5.x` latest. If we adopt 16 later, log it here.

---

## D7 — `experimental.typedRoutes` → `typedRoutes`

**Status:** chosen.

**Spec position:** SPEC silent.

**Decision:** Use the stable `typedRoutes: true` flag in `next.config.ts`. Affects: dynamic URLs in `home-client.tsx` and `compare-toast.tsx` cast through `as Route` because the route shapes include user-supplied search params.

---

## D8 — OpenFreeMap "liberty" as the OSS basemap

**Status:** chosen, swap-able.

**Spec position:** SPEC §4 prescribes MapTiler streets-v2.

**Decision:** When `NEXT_PUBLIC_MAPTILER_KEY` is unset, use OpenFreeMap "liberty" (CC-BY). It has visibly more interesting terrain colour than "positron" and reads better as a hero map. Production with MapTiler key is unaffected.

---

## D9 — Crime / permits / trees data volume cap

**Status:** chosen.

**Spec position:** SPEC silent on per-source row caps.

**Decision:** `scripts/ingest-real.ts` caps each Socrata query at:
- Crime: 50,000 rolling-365-day incidents (≈13 MB GeoJSON).
- Permits: 20,000 most-recent-24-month permits (≈8 MB).
- Trees: 30,000 sample (≈6 MB).

These files live in `public/data/` and are server-side-only — they're not shipped to the client. The map renderer never loads them. The concern engine reads them server-side and returns just the concerns array.

For PostGIS deploy, drop the caps and rely on GIST indexes for filter speed.

---

## D11 — No database for v1; SQLite ruled out; Supabase Postgres+PostGIS when needed

**Status:** chosen.

**Spec position:** SPEC §2.2 prescribes Postgres 15 + PostGIS 3.4 via Supabase. SPEC §2.3 says "GitHub Actions on cron and push results to Supabase Storage, then trigger a Vercel route to swap them in atomically" — i.e. authoritatively allows file-based artifacts.

**Decision:** v1 ships **without a provisioned database**. The 20 layers live as versioned GeoJSON in `public/data/`; the concern engine reads them via `src/server/concerns/data-source.ts`; Vercel's CDN serves them. The Drizzle schema (`db/schema.ts`) and PostGIS migration (`db/migrations/0000_init.sql`) are scaffolded for the moment a DB is wanted, but `npm run dev` and a production deploy work fully without one.

**Why not SQLite (asked frequently):**
1. **Spatial queries are the entire app.** SQLite's spatial extension is SpatiaLite, a C library. Vercel serverless does not allow runtime native-extension loading, and the build pipeline for `better-sqlite3` + SpatiaLite on Vercel is fragile.
2. **No persistent disk on serverless.** A SQLite file would either be baked read-only into the deployment artifact (incompatible with daily ingestion) or live on per-instance ephemeral disk (lost on every cold start).
3. **Drizzle's spatial story is much stronger on Postgres.** PostGIS is the standard surface area for `ST_Contains` / `ST_DWithin` and the migration in `db/migrations/0000_init.sql` is built on it.

**When persistence becomes necessary** (M5: auth, saved addresses, agent dashboard), provision Supabase free tier:
- 500 MB Postgres + PostGIS 3.4 (our SF dataset is ~50 MB compressed)
- 50 k MAU auth
- Pause-after-7-days-inactive on free; trivial to wake; upgrade to Pro ($25/mo) for always-on production

Alternatives evaluated:
- **Neon free**: no PostGIS on free, only on Launch ($19/mo). Worse deal than Supabase.
- **Turso / Cloudflare D1**: SQLite again — same spatial-extension problem.
- **Self-hosted Postgres on Railway/Fly**: works at $5–10/mo. Strictly worse than Supabase free.

---

## D12 — Liquefaction overlay sourced from DataSF, treated as combined seismic hazard zone

**Status:** chosen.

**Spec position:** SPEC §2.1 layer 1 cites the CGS regulatory shapefile and labels the layer "CGS Liquefaction & seismic hazard zones."

**Decision:** The overlay polygons in `public/data/seismic_liquefaction.geojson` are now ingested live from DataSF dataset `re79-p8j5` (the underlying tabular asset of the public map at `https://data.sfgov.org/-/San-Francisco-Seismic-Hazard-Zones/7ahv-68ap`). DataSF mirrors the CGS regulatory map clipped to SF and is the authoritative source for the polygons most San Francisco buyers and inspectors actually see. The previous file was hand-encoded from the v0 prototype and visibly diverged from the regulatory map.

The DataSF dataset combines all three CGS hazard categories (liquefaction, earthquake-induced landslide, overlap) into a single polygon set without a `zone_type` column. We surface this honestly in the UI:

- Layer toggle label: "Seismic hazard zones (CGS)" (was "Liquefaction (CGS)").
- Concern title (in-zone): "Inside CGS regulatory seismic hazard zone" with body explaining it's either liquefaction (bay fill / alluvium) or earthquake-induced landslide (steep slopes), depending on local geology. The disclosure trigger is identical in both cases.
- Layer ID, severity key (`liquefaction.in_zone`), and concern `layer` discriminator are unchanged so the data pipeline and severity tables don't move.

**Path forward:** if CGS publishes a typed feed (or we go direct to the CGS ArcGIS REST endpoint that does carry zone type), enrich each feature with `zone_type ∈ {liquefaction, landslide, overlap}` and split copy + severity per type.

---

## D10 — Test coverage scope

**Status:** chosen.

**Spec position:** SPEC §13 — "Playwright golden-path test green in CI."

**Decision:** Vitest unit suite covers the concern engine, severity tables, geo helpers, deterministic LLM, and URL state. Playwright covers golden path + about + compare + out-of-SF API. CI integration is `npm run test && npm run test:e2e` — wire to Vercel previews when ready.

---

## D13 — Optional Supabase saved homes; ship without DB; dependency baseline

**Status:** chosen.

**Spec position:** D11 — core map + concerns work without a provisioned database. SPEC §1.2 lists "No user-generated content" as a v1 non-goal; saved homes are an intentional product extension layered on top of the same degradation story as D1.

**Decision:**

1. **Saved homes / auth UI** (`AuthButton`, `SavedHomesDock`) render only when `NEXT_PUBLIC_SUPABASE_URL` and a public client key (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are set. Deploys without those vars behave like the file-backed concern engine only; no broken sign-in chrome.
2. **Tables and RLS** for saved homes live in `db/migrations/0001_saved_homes.sql`. Until that SQL is applied in Supabase, client calls fail gracefully at the network layer; finishing DB setup is operational, not a code deploy blocker.
3. **`package.json` baseline** stays on **Next.js 15.5.x** with React 19, `@sentry/nextjs` 10.x, Drizzle 0.36.x, Vitest 2.x. A bad lockfile once resolved `next` to 9.x and broke `next build`; CI should treat `npm run build` as mandatory on PRs.
