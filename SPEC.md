# Theami v1 — SF Real Estate Guide

> Comprehensive product + technical specification for the v1 implementation of the SF home-shopping map at **theami.ai**. Written for a mid-level engineering AI to implement end-to-end. Choices below are opinionated; defer to them unless you have a specific reason not to. Where the spec is silent, follow the conventions in this doc rather than inventing new ones.

---

## 0. Executive summary

Theami is a single-page web app at `theami.ai` that answers one question for any San Francisco address:

> **"What should I look out for here, and on what time horizon?"**

Flow: address autocomplete → pin drops on a premium vector map → right-side panel computes 15+ structured concerns from authoritative city/state/federal datasets → an LLM summarizes the concerns into a streaming, plain-English brief weighted by the user's chosen 5/7/10/15-year horizon. Every claim cites a primary source.

Hero is the **map experience**. Data must be **authoritative and fresh** (no hand-encoded geometry). Audience is **SF real-estate agents and engaged buyers**.

---

## 1. Product spec

### 1.1 Vision

The opposite of Zillow. Zillow tells you about the *house*. Theami tells you about the *block* — seismic substrate, upzoning pipeline, flood model, construction next door, schools, fog, noise. For agents, a single shareable URL that turns 90 minutes of disclosure-package work into a 10-second briefing. For buyers, a defensible answer to "should I worry?" with sources.

### 1.2 Non-goals (v1)

- No listings, prices, or comps. (Use Zillow / Redfin.)
- No mortgage / financing tooling.
- No coverage outside SF. The architecture must support multi-city later, but ingestion is SF-only for v1.
- No user-generated content.
- No native mobile apps. Responsive web only.

### 1.3 Audience & jobs-to-be-done

| Persona | Job-to-be-done |
|---|---|
| **Engaged buyer** | "Before I make an offer at 321 Church St, what am I missing?" |
| **Buyer's agent** | "I'm showing a client 5 properties Saturday — give me a one-pager per address I can text them." |
| **Listing agent** | "I want a defensible answer to 'what about the upzoning?' from cautious buyers." |

### 1.4 Core user flow

1. Land on theami.ai → big address bar, hero map of SF behind it.
2. Type address → Google Places autocomplete → select.
3. Map smooth-flies (≈1.2 s ease-out) to the address. Pin drops.
4. Right panel slides in (skeleton state), then the LLM summary streams in token-by-token.
5. Below the summary: **Concerns** list (Alerts / Watch / Favor / Context), each with a source link and an action item.
6. Above the summary: **Horizon selector** (5 / 7 / 10 / 15) — re-weights severities and re-runs the summary.
7. Optional: **Compare** stacks up to 4 addresses side-by-side.
8. Optional: **Share** generates a permalink (URL is canonical state).
9. Optional: **Print** generates an agent-friendly single-page brief.

### 1.5 Information architecture

| Route | Purpose |
|---|---|
| `/` | Hero search + hero map. |
| `/?lat=…&lng=…&h=10` | Address page (URL is the source of truth). |
| `/compare?addr=…&addr=…` | Compare up to 4 saved addresses. |
| `/about` | Methodology, sources, disclaimer. |
| `/dashboard` *(M5)* | Agent dashboard with saved addresses + lists. |

---

## 2. Data

The single biggest upgrade vs. v0: **data is fetched and refreshed on schedule, not hand-encoded**. Every layer has a named source, a refresh cadence, and a provenance record per row.

### 2.1 Layers

20 underlying layers, presented to the user as ~7 concern categories (Seismic, Flood, Zoning, Construction, Safety, Schools/Transit, Property/Legal).

| # | Layer | Concern | Source | Refresh |
|---|---|---|---|---|
| 1 | CGS Liquefaction & seismic hazard zones | Seismic | CGS regulatory shapefile | Annual |
| 2 | USGS Quaternary fault traces | Seismic | USGS | Annual |
| 3 | Soft-story properties | Seismic | DataSF `jwdp-cqyc` | Weekly |
| 4 | FEMA flood zones (NFHL) | Flood | FEMA ArcGIS REST | Monthly |
| 5 | NOAA SLR scenarios (1/3/6 ft) | Flood | NOAA SLR Viewer | Annual |
| 6 | Pluvial flood / sewer-overflow history | Flood | SF Planning Combined Flood Map | Annual |
| 7 | Family Zoning Plan corridors + decontrol zones | Zoning | SF Planning shapefile (manual) | Quarterly |
| 8 | DBI building permits, 500 ft radius | Construction | DataSF `i98e-djp9` | Daily |
| 9 | SF Planning project pipeline, 500 ft radius | Construction | SF Planning ArcGIS | Daily |
| 10 | Article 10 + 11 historic districts | Legal | SF Planning ArcGIS | Annual |
| 11 | Vision Zero High Injury Network | Pedestrian safety | DataSF + SFMTA | Annual |
| 12 | SFPD incidents (rolling 12 mo) | Crime | DataSF `wg3w-h783` | Daily |
| 13 | Schools + GreatSchools ratings + lottery zones | Schools | GreatSchools (manual sync) + SFUSD | Annual |
| 14 | BART + Muni Metro + Muni rapid stops | Transit | GTFS feeds (BART + SFMTA) | Weekly |
| 15 | SFO + OAK flight paths + 65 dB DNL contours | Aircraft noise | FAA / SFO Noise Office | Annual |
| 16 | Microclimate (fog) | Climate | UC Berkeley microclimate (static) | None |
| 17 | Air quality (rolling) | Health | PurpleAir + BAAQMD | Hourly |
| 18 | Property assessor record | Property | DataSF assessor recorder | Quarterly |
| 19 | DBI complaints + violations on parcel | Property | DataSF | Daily |
| 20 | Tree canopy / urban forest | Quality of life | DataSF Street Trees | Annual |

Defer paid sources (GreatSchools API) until budget confirmed (Section 11).

### 2.2 Spatial schema (PostgreSQL 15 + PostGIS 3.4)

```sql
neighborhoods       (id, name, slug, geom POLYGON, source_url, ingested_at)
hazard_zones        (id, layer_id, severity, properties JSONB, geom GEOMETRY, ingested_at)
hin_corridors       (id, name, geom LINESTRING, ingested_at)
upzoned_corridors   (id, name, max_height_ft, effective_date, geom LINESTRING, ingested_at)
historic_districts  (id, name, article INT, geom POLYGON, ingested_at)
building_permits    (id, parcel, status, work_class, geom POINT, filed_at, last_action_at, ingested_at)
schools             (id, name, rating, level, geom POINT, lottery_url, ingested_at)
transit_stops       (id, system, name, geom POINT, lines TEXT[], ingested_at)
crime_incidents     (id, category, geom POINT, occurred_at, ingested_at)  -- partition by month
parcels             (apn, address, geom POLYGON, year_built, beds, baths, sqft,
                     last_sale_price, last_sale_date, ingested_at)
ingestion_runs      (id, source, started_at, ended_at, rows_added, rows_updated, status, error)
```

Indexes:
- GIST on every `geom` column.
- BRIN on every `ingested_at` and on `crime_incidents.occurred_at`.
- B-tree on `parcels.address` (trigram for fuzzy matching).

Migration tool: **Drizzle Kit**. Migration files live at `db/migrations/`.

### 2.3 Ingestion pipeline

- **Where it runs**: Vercel Cron triggers serverless ingestion routes for hourly/daily jobs. Heavy weekly jobs (CGS shapefile re-tiling, GTFS imports) run as **GitHub Actions** on cron and push results to **Supabase Storage**, then trigger a Vercel route to swap them in atomically.
- **Pattern**: One module per source at `src/server/ingest/<source>.ts`, each exporting `{ schedule, run }`. Idempotent — every run is a full upsert by stable ID.
- **Validation**: Zod schemas at the API boundary. Row counts compared to last run; > ±20 % delta triggers a Sentry alert and **does not commit**.
- **Provenance**: every row stores `source_url`, `source_id`, `source_last_modified`, `ingested_at`. Every concern surfaced to the user resolves back to a `source_url` for the UI's source link.

---

## 3. LLM integration

### 3.1 Pipeline

```
[address]
   → [geocode]
   → [spatial query: hits across 20 layers]
   → [structured concerns array (typed)]
   → [LLM with horizon, neighborhood, concerns]
   → [streaming summary + bullets]
```

The LLM **never re-ranks raw data or invents claims**. It only summarizes the structured concerns array. Every bullet must reference a `concern.id`; the renderer rejects bullets without a valid ID and falls back to a plain list of titles.

### 3.2 Models

- **Production**: `claude-sonnet-4-6` for the address summary. Strong reasoning, good cost, low latency.
- **Live preview**: `claude-haiku-4-5-20251001` for sub-second responses while the user drags the horizon slider.
- SDK: `@anthropic-ai/sdk` via Vercel AI SDK (`@ai-sdk/anthropic`). Streaming. Tool use disabled.

### 3.3 Horizon semantics

The horizon is a knob on **how to weight severity by time-relevance**. Each layer ships with a typed `SEVERITY_BY_HORIZON` constant in code; tweaking is a normal PR.

Example:

| Concern | 5 yr | 10 yr | 15 yr |
|---|---|---|---|
| FEMA flood zone | alert | alert | alert |
| NOAA SLR 3 ft scenario | context | watch | alert |
| NOAA SLR 6 ft scenario | context | context | watch |
| Upzoned corridor frontage | watch | alert | alert |
| Soft-story neighborhood | watch | watch | watch |
| Construction permit < 500 ft | alert | watch | context |
| GreatSchools rating ≥ 8 within 1200 m | favor | favor | favor |

The LLM is told the horizon explicitly in the system prompt and is instructed to lead with the highest-severity concerns *at that horizon*.

### 3.4 Prompt structure (with caching)

The Anthropic prompt cache cuts cost and latency dramatically. Structure prompts so the longest pieces are stable across requests.

```
[CACHE_CONTROL: ephemeral]    System prompt: persona, output schema, horizon definitions
[CACHE_CONTROL: ephemeral]    Methodology block: each layer → severity decision table
[NOT CACHED]                  Per-address: address, neighborhood, horizon, concerns array
```

Cache version key: `system_v3 + methodology_v3` (bump when either changes; old cache expires within 5 min).

### 3.5 Output schema (JSON, streamed)

```json
{
  "headline": "Hillside Duboce Triangle. Modest upzoning exposure on Church.",
  "bullets": [
    { "severity": "alert", "concern_id": "flood_fema_x_001", "text": "..." },
    { "severity": "favor", "concern_id": "transit_muni_metro", "text": "..." }
  ],
  "outlook": "Over the next 10 years, the dominant story is...",
  "verdict": "neutral" // alert | watch | neutral | favor — one-word call
}
```

### 3.6 Caching

| Layer | Key | TTL | Invalidation |
|---|---|---|---|
| **Geocode** | `place_id` | 30 d | manual flush |
| **Concerns** | `geohash8 + horizon` | 24 h | bump on any layer's `ingested_at` |
| **LLM summary** | `geohash8 + horizon + concerns_hash` | 24 h | bump on `concerns_hash` change |
| **Vector tiles** | served by MapTiler with their CDN | n/a | n/a |

`geohash8` ≈ 38 m × 19 m: adjacent units share a summary, but a different block doesn't.

### 3.7 Cost / latency budgets

- p50 end-to-end (autocomplete pick → first token of summary): **< 1.5 s**
- p95: **< 4 s**
- LLM cost at scale: **< $0.005 / address** (Sonnet 4.6 with prompt caching)
- Geocoding cost: **$5 / 1 000** (Google Geocoding) — cache aggressively

---

## 4. Tech stack

Opinionated. Pick these. Reasons live in the right column; if you have a strong reason to deviate, document it in `DECISIONS.md`.

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15** (App Router, RSC) | Streaming-friendly, edge-runnable, deploys to Vercel zero-config |
| Language | **TypeScript strict** | No `any` in checked-in code; `noUncheckedIndexedAccess: true` |
| Map library | **MapLibre GL JS 4** | Smooth vector tile rendering, full styling, no Mapbox lock-in |
| Vector tiles | **MapTiler Cloud** (Streets v2 + Topo for hill-shade) | Premium feel, generous free tier, swap-able to Stadia later |
| Address autocomplete + geocoding | **Google Places API (New)** + **Geocoding API** | User-specified; server-proxied |
| Database | **Supabase** (Postgres 15 + PostGIS 3.4) | Managed PostGIS, free tier, optional auth/storage later |
| ORM | **Drizzle ORM** | Type-safe, light, supports raw SQL + PostGIS extensions cleanly |
| LLM SDK | **`@anthropic-ai/sdk`** + **Vercel AI SDK** (`ai`, `@ai-sdk/anthropic`) | Streaming, prompt cache, ergonomic React hooks |
| Server-side state cache | **Upstash Redis** | Serverless-friendly, REST-based |
| Server state on client | **TanStack Query v5** | Cache, retries, devtools |
| Styling | **Tailwind CSS v4** (CSS-first, `@theme`) | Fast iteration, no separate config file |
| Components | **shadcn/ui** on top of **Radix primitives** | Accessible, copy-not-import |
| Animation | **Framer Motion 11** | Premium-feel transitions; easy reduced-motion |
| Forms | **react-hook-form + zod** | Standard, light |
| Icons | **Lucide** | Clean, consistent stroke weight |
| Fonts | **Inter** + **Newsreader** + **JetBrains Mono** via `next/font` | Carry forward v0 typography |
| Cron | **Vercel Cron** for hourly/daily; **GitHub Actions** for heavy weekly | Native, free at this scale |
| Errors | **Sentry** (browser + node) | Sourcemaps, release tracking |
| Analytics | **Vercel Analytics** + **PostHog** | Funnel + session replay |
| Tests | **Vitest** (unit) + **Playwright** (one e2e covering the golden path) | Fast, modern |
| Lint / format | **Biome** | One tool replaces ESLint+Prettier |
| Deploy | **Vercel** (Pro) | Edge functions, cron, preview URLs |
| DNS | **Cloudflare** in front of **Vercel** for theami.ai | Asset caching, DDoS at the edge |
| Secrets | Vercel project envs (Doppler optional) | One source of truth |

---

## 5. Architecture

```
                ┌──────────────────────────────────┐
                │         theami.ai (Vercel)       │
                │                                  │
   Browser ───▶ │  Next.js 15 (RSC + edge runtime) │
                │   ├─ /                           │
                │   ├─ /compare                    │
                │   ├─ /api/concerns               │
                │   ├─ /api/summary  (streaming)   │
                │   ├─ /api/geocode  (Google proxy)│
                │   └─ /api/ingest/*  (Vercel Cron)│
                └────────┬───────────────┬─────────┘
                         │               │
              ┌──────────▼─────┐   ┌─────▼──────────────┐
              │ Supabase       │   │ Anthropic API      │
              │ Postgres + GIS │   │ Sonnet 4.6 / Haiku │
              └────────┬───────┘   │ + prompt cache     │
                       │           └────────────────────┘
              ┌────────▼─────┐
              │ Upstash      │ ← cache: geocode, concerns, LLM
              │ Redis        │
              └──────────────┘

External (read-only):
  • Google Places + Geocoding (server-proxied)
  • MapTiler (vector tiles, client-side, domain-restricted key)
  • DataSF, FEMA, CGS, USGS, NOAA, SF Planning, GTFS, BAAQMD, PurpleAir  (cron-pulled)
```

Edge vs. node runtime:
- `/api/summary` and `/api/geocode` → **Edge** (low latency, streaming).
- `/api/concerns` → **Node** (PostGIS query needs a node-pg driver).
- `/api/ingest/*` → **Node** (long-running, may need 60+ s; use `maxDuration: 300`).

---

## 6. UX & design

### 6.1 Layout — desktop

- **Full-bleed map** background.
- **Top-center floating search bar** (max-w-xl, glass surface, Inter 16 px). Persists after selection as a chip-style breadcrumb: `📍 321 Church St ×`.
- **Right-side panel**, 420 px wide, slides in from right when an address is selected. Glass effect (`backdrop-filter: blur(24px) saturate(140%)`, `background: rgba(255,255,255,0.72)`). Newsreader for headlines, Inter for body.
- **Horizon selector** at the top of the panel — segmented control `5y · 7y · 10y · 15y` with sliding-underline animation.
- **Layer toggles** in a small floating control on the bottom-right of the map (shadcn Popover, anchor-bottom-right).
- **Compare toast** appears bottom-center when ≥ 2 addresses are saved: `Compare (2) →`.
- **Help / shortcuts** in a `?` button at top-right. Same shortcuts as v0 plus new ones for horizon (`H` cycles).

### 6.2 Layout — mobile

- Map full-screen behind.
- Address bar pinned at the top, full-width, safe-area aware.
- Panel becomes a **bottom sheet** at 50 % screen height by default; drag to expand to 90 %.
- Horizon selector lives inside the sheet header.
- Compare disabled on small viewports (< 640 px) — show a "open on a larger screen" CTA instead.

### 6.3 Interactions

- **Address selection**: 1.2 s `flyTo`, ease-out-cubic, target zoom 16. Pin drops with a 200 ms scale-in. Concurrent: panel slides in (300 ms) with skeleton; LLM stream begins as soon as concerns return.
- **Horizon change**: re-runs the concern engine in < 50 ms (purely re-weights cached layer hits) and re-runs the LLM (1–3 s). Bullets crossfade per item.
- **Layer toggle**: instant. Hazard polygons fade in/out 200 ms.
- **Map click on a hazard polygon**: highlights the matching concern in the panel and scrolls it into view.
- **Source link**: opens in a new tab. Always.
- **Loading**: skeleton shapes everywhere. No spinners on the main flow.
- **Empty state** (address outside SF): friendly redirect with "we only cover SF for now — try a SF address."
- **Error**: inline, never modal. Mention the source ("FEMA NFHL fetch failed; flood data may be stale") and continue.

### 6.4 Design tokens

Carry forward v0's editorial palette as the base; add construction / legal / air / noise layer colors for v1.

```css
:root {
  /* Surfaces */
  --bg: #fafaf7;
  --surface: #ffffff;
  --surface-glass: rgba(255, 255, 255, 0.72);
  --backdrop-blur: 24px;

  /* Ink */
  --ink: #0a0a0a;
  --text: #151515;
  --text-2: #525252;
  --text-3: #8a8a8a;

  /* Severity */
  --alert: #9b1c1c;
  --watch: #a3531b;
  --favor: #0f5f33;
  --neutral: #525252;

  /* Layer hues */
  --seismic: #a3531b;
  --flood: #125a8a;
  --upzone: #1f2937;
  --softstory: #854d0e;
  --safety: #9b1c1c;
  --schools: #0f5f33;
  --transit: #0a5e5e;
  --fog: #475569;
  --construction: #5b21b6;     /* new */
  --legal: #374151;             /* new */
  --air: #0e7490;               /* new */
  --noise: #7c2d12;             /* new */

  /* Type */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-serif: 'Newsreader', Georgia, serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  /* Motion */
  --ease-entrance: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-emphasis: cubic-bezier(0.65, 0, 0.35, 1);
}
```

Type scale:
- Display: Newsreader 600, letter-spacing −0.02 em.
- Headline: Inter 600.
- Body: Inter 400 / 14 px / 1.5.
- All numbers: `font-variant-numeric: tabular-nums`.

Motion durations: `180 / 240 / 320 / 480 ms`. All transitions respect `prefers-reduced-motion: reduce` — flyTo durations drop to 0; panel transitions become opacity-only.

### 6.5 Performance budgets

- LCP: **< 1.8 s** on 4 G mid-tier mobile.
- TTI: **< 3 s**.
- JS initial bundle: **< 250 KB gzipped**, including MapLibre.
- Total Blocking Time: **< 200 ms**.
- Map: **60 fps** pan/zoom on a MacBook Air M1; 30 fps minimum on iPhone 12.

### 6.6 Accessibility

- Every action keyboard-reachable. `/` focuses the address bar (carry from v0). Map pan with arrow keys.
- Concerns list is an `<ol>`; severity announced via `aria-label`. Headlines are real `<h2>`.
- Contrast: all text against the lightest possible map background must hit WCAG AA. Use a subtle `text-shadow` on map labels, never on panel text.
- Focus states: 2 px solid `--ink` outline, 4 px offset. Never remove default outlines without replacing them.

---

## 7. API contracts

### 7.1 `GET /api/concerns`

```ts
GET /api/concerns?lat=37.7665&lng=-122.4294&horizon=10

200
{
  "address": {
    "lat": 37.7665, "lng": -122.4294,
    "neighborhood": "Duboce Triangle"
  },
  "horizon": 10,
  "concerns": [
    {
      "id": "flood_fema_x_001",
      "layer": "flood",
      "severity": "favor",
      "title": "Outside FEMA SFHA",
      "body": "...",
      "action": "Standard hazard insurance suffices.",
      "source": { "label": "FEMA NFHL", "url": "https://msc.fema.gov/..." },
      "ingested_at": "2026-04-20T08:00:00Z"
    }
  ],
  "concerns_hash": "sha1:abc123…"
}
```

Cached by `(geohash8, horizon)` for 24 h.

### 7.2 `POST /api/summary`  (streaming)

```ts
POST /api/summary
Content-Type: application/json
{ "concerns": [...], "address": {...}, "horizon": 10, "concerns_hash": "..." }

200  text/event-stream
data: {"type":"headline","value":"Hillside Duboce..."}
data: {"type":"bullet","value":{"severity":"alert","concern_id":"flood_fema_x_001","text":"..."}}
data: {"type":"outlook","value":"Over the next 10 years..."}
data: {"type":"verdict","value":"neutral"}
data: [DONE]
```

The client renders incrementally; bullets without a valid `concern_id` are dropped on the floor.

### 7.3 `POST /api/geocode`

```ts
POST /api/geocode
{ "place_id": "ChIJ..." }

200
{
  "lat": 37.7665, "lng": -122.4294,
  "formatted": "321 Church St, San Francisco, CA 94114",
  "components": { "neighborhood": "Duboce Triangle", "zip": "94114" }
}
```

Server-side proxy. Google API key never leaves the server.

### 7.4 `POST /api/ingest/<source>` (cron-only)

Header: `Authorization: Bearer ${VERCEL_CRON_SECRET}`.
Body: empty.
200: `{ rows_added, rows_updated, ms, status: "ok" | "drift_blocked" }`.

---

## 8. Repository layout

```
.
├── SPEC.md                            ← this file
├── DECISIONS.md                       ← log of any deviation from this spec
├── README.md                          ← getting-started for humans
├── package.json
├── biome.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.css                ← Tailwind v4 @theme
├── drizzle.config.ts
├── .env.example
├── db/
│   ├── schema.ts                      ← Drizzle schema (Section 2.2)
│   ├── migrations/                    ← drizzle-kit output
│   └── seed.ts                        ← dev data
├── public/
│   ├── og.png
│   └── favicon.svg
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                   ← /
│   │   ├── compare/page.tsx
│   │   ├── about/page.tsx
│   │   └── api/
│   │       ├── concerns/route.ts
│   │       ├── summary/route.ts
│   │       ├── geocode/route.ts
│   │       └── ingest/[source]/route.ts
│   ├── components/
│   │   ├── map/                        ← MapLibre wrapper, layer renderers
│   │   ├── panel/                      ← Right-side panel, horizon, concerns list, summary
│   │   ├── search/                     ← Address autocomplete
│   │   ├── compare/                    ← Compare grid
│   │   └── ui/                         ← shadcn primitives
│   ├── server/
│   │   ├── concerns/                   ← spatial query → structured concerns
│   │   │   ├── index.ts                ← concernsAt(lat, lng, horizon)
│   │   │   ├── layers/
│   │   │   │   ├── liquefaction.ts
│   │   │   │   ├── flood.ts
│   │   │   │   ├── upzoning.ts
│   │   │   │   └── ...                 ← one per layer
│   │   │   └── severity.ts             ← SEVERITY_BY_HORIZON tables
│   │   ├── llm/
│   │   │   ├── summarize.ts            ← streaming summary
│   │   │   ├── prompts.ts              ← system + methodology blocks
│   │   │   └── schema.ts               ← zod for the JSON output
│   │   ├── ingest/
│   │   │   ├── cgs-liquefaction.ts
│   │   │   ├── fema-nfhl.ts
│   │   │   ├── datasf-softstory.ts
│   │   │   └── ...                     ← one per source
│   │   ├── cache/
│   │   │   └── redis.ts                ← Upstash client + helpers
│   │   └── google/
│   │       └── places.ts
│   ├── lib/
│   │   ├── geo.ts                      ← haversine, geohash, distance helpers
│   │   ├── url.ts                      ← URL state encode/decode
│   │   └── analytics.ts
│   └── types/
│       └── concern.ts
└── tests/
    ├── unit/
    │   ├── severity.test.ts
    │   └── geo.test.ts
    └── e2e/
        └── golden-path.spec.ts        ← Playwright: home → search → flyTo → summary
```

The repo root (a sibling of `v0/`) is the project. `v0/` remains as the archived prototype.

---

## 9. Build milestones

Each milestone is a shippable demo to the user (Pedram). Don't merge a milestone PR until the demo passes manually.

### M1 — Skeleton (≈ week 1)

- Next.js 15 scaffold at the repo root. Biome + TypeScript strict.
- Tailwind v4, design tokens (Section 6.4) wired.
- MapLibre + MapTiler tiles, centered on SF, with the pane ordering carried from v0.
- Address bar with Google Places autocomplete via a Server Action proxy.
- Right panel slides in on selection. Placeholder concerns array (hard-coded sample).
- Horizon selector renders (no behavior).
- Deploy to **theami.ai** at the end of the week.

**Demo**: type address → pin drops, panel slides in.

### M2 — Data (weeks 2–3)

- Supabase project + PostGIS extension + Drizzle schema (Section 2.2).
- Ingestion modules for: CGS liquefaction, FEMA NFHL, DataSF soft-story, SF Planning zoning, DataSF HIN, DataSF crime (rolling 12 mo), DBI permits.
- `/api/concerns` returns real data from PostGIS.
- Panel shows real concerns with sources and dates (no LLM yet).
- All hazard layers renderable on map; bottom-right popover toggles them.

**Demo**: real concerns at any SF address, every claim sourced and timestamped.

### M3 — LLM (week 4)

- Anthropic SDK wired with prompt caching (Section 3.4).
- `/api/summary` streams Sonnet 4.6 output.
- Horizon selector re-runs concerns + summary; Haiku for live preview during slider drag.
- LLM output cached per `(geohash8, horizon, concerns_hash)` in Upstash.
- Reduced-motion + keyboard support audit.

**Demo**: end-to-end smooth flow: address → streaming summary → horizon changes update bullets in real time.

### M4 — Polish (week 5)

- Compare view (up to 4 addresses, bottom-toast → grid).
- Print view (single column, no map; agent-friendly).
- Share permalink (copy-to-clipboard).
- Empty / error / out-of-SF states.
- Sentry + PostHog wired.
- Performance pass to hit budgets in Section 6.5.
- Disclaimer + About + Sources page.

**Demo**: launch-ready.

### M5 — Auth + saved addresses (post-launch)

- Supabase Auth (magic link).
- Saved addresses, named lists ("Pedram's Saturday tour").
- Agent dashboard at `/dashboard`.
- Bulk PDF export for agents.

---

## 10. Environment & secrets

```
ANTHROPIC_API_KEY            — Claude (server only)
GOOGLE_MAPS_API_KEY          — Places + Geocoding (server only; restrict by referrer)
NEXT_PUBLIC_MAPTILER_KEY     — vector tiles (client, restricted by domain)
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY    — server only
NEXT_PUBLIC_SUPABASE_ANON_KEY
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
SENTRY_DSN
NEXT_PUBLIC_POSTHOG_KEY
VERCEL_CRON_SECRET           — protects /api/ingest/*
DATASF_APP_TOKEN             — Socrata throttling exemption (free)
```

Never commit. `.env.example` mirrors the names without values.

---

## 11. Open questions / assumptions to confirm before M2

These are reversible cheaply if wrong; confirm them with the user before committing to M2.

1. **SF only for v1.** ✅ (User's pitch said so.)
2. **No auth for v1.** Saved addresses go in `localStorage`. Auth is M5.
3. **Google Places + Geocoding** for all addresses, server-proxied. Estimated cost ~$25 / mo at modest traffic.
4. **MapTiler** for tiles vs. self-hosted. Assumed MapTiler for premium feel + zero ops.
5. **Claude Sonnet 4.6** as the production summarization model. Acceptable cost?
6. **GreatSchools data**: no public free API. Options: pay for the GreatSchools API ($), scrape (legally murky), or rely only on SFUSD-published data. **Decision needed before M2.**
7. **Print** = HTML print stylesheet (cheap) vs. server-side PDF via Puppeteer (premium). Assumed HTML print.
8. **Disclaimer wording**: reuse v0's verbatim unless legal review says otherwise.
9. **Audience scope**: spec assumes both buyers and agents see the same product. If agents need a separate "agent mode" with bulk export and custom branding, that's M5+ — confirm before M5.
10. **Personal-favorites bias from v0**: v0 hardcodes 321 Church St + a Pedram-and-Sara shortlist. v1 has no curated shortlist on the home page; saved-addresses are per-user (M5). Confirm this is the right call.

---

## 12. Reuse / cut from v0

**Reuse**

- The shape of `concernsAt(lat, lng, nhood)` and the four-severity vocabulary (alert / watch / favor / neutral). It's the right product.
- Per-layer hit/miss copy from `v0/sf-neighborhood-risk-map.html` (`concernsAt`, lines ~1836–2027) — port as starting strings; rewrite for v1's tone but keep the action-item style.
- Layer color palette (Section 6.4 carries v0's hues; new layers add new tokens).
- Methodology around hand-encoded vs. authoritative geometry — write the v1 schema knowing every layer needs a provenance story.
- Keyboard shortcuts: `/` for search, `Esc` to close, `[`/`]` for sidebar/panel.

**Cut**

- The HTML/CSS/JS structure (single file, no framework, hand-encoded data). Don't port any DOM code.
- The 14-layer scoring matrix and weight sliders mentioned in `v0/changelog.md` were rolled back in the readme's "v2." We're going with the readme's concern-list approach, not the changelog's scoring matrix.
- The hardcoded shortlist (NOPA, Cole Valley, Hayes Valley, …) in `TARGETS`. v1 has no curated shortlist on the home page.
- Doc-internal version names ("v1" / "v2"). The repo-level `v0/` is the prior generation; the repo root is what we're building.

---

## 13. Definition of done (launch checklist for M4)

- [ ] All 20 layers ingesting on schedule with green ingestion runs.
- [ ] Every concern card has a working source link.
- [ ] p50 < 1.5 s, p95 < 4 s on 50 representative SF addresses.
- [ ] Lighthouse: Performance ≥ 90, Accessibility = 100 on `/`.
- [ ] Playwright golden-path test green in CI.
- [ ] Sentry + PostHog receiving events.
- [ ] Print stylesheet renders the right panel as a single A4 page.
- [ ] Compare works for 2, 3, and 4 addresses.
- [ ] Empty / error / out-of-SF states tested and copy-reviewed.
- [ ] Disclaimer present in footer of every page.
- [ ] DNS: theami.ai resolving, HTTPS green, www → apex.
- [ ] One real-estate agent has used it for a real client and given written feedback.

---

## 14. Disclaimer (footer copy)

> For informational purposes only. Verify with licensed professionals (structural engineer, real-estate attorney, insurance broker) before any purchase decision. Does not constitute real estate, legal, seismic, or financial advice. Sources are public records and may be out of date — every concern shows its `ingested_at`.
