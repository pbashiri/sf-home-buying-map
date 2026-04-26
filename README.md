# Theami v1

> The opposite of Zillow. Tells you about the **block**, not the house. For any San Francisco address, what to look out for and on what time horizon — every claim sourced.

`SPEC.md` is authoritative. This README is the human-friendly getting-started.

---

## What's running

Theami v1 is a Next.js 15 / React 19 single-page app. It answers one question for any SF address: **"What should I look out for here, and on what time horizon?"**

Flow: address autocomplete → pin drops → spatial query against 20+ data layers → typed `concerns` array → LLM summary streamed by horizon (5/7/10/15 yrs) → editorial brief with sources.

The architecture is structured for graceful degradation, so the app runs end-to-end **without any external API keys**:

| Service | When key set | When key absent |
|---|---|---|
| Anthropic | Claude Sonnet 4.5 (prod) / Haiku (preview), prompt-cached | Deterministic structured-summary stub (same SSE schema) |
| Google Places + Geocoding | Server-proxied autocomplete + geocode | Local SF gazetteer (40 neighborhoods) + Nominatim fallback |
| MapTiler | Premium streets-v2 vector tiles | OpenFreeMap "liberty" (CC-BY) |
| Supabase + PostGIS | DB-backed concerns | GeoJSON files in `public/data/` |
| Upstash Redis | Cross-instance summary cache | In-process LRU |

---

## Quickstart

```bash
npm install
npm run dev
# → http://localhost:3000
```

You don't need any env vars to see the app working. Add them to `.env.local` (mirroring `.env.example`) when you want production behaviour.

To pull fresh real-world data into `public/data/`:

```bash
npm run ingest:all
```

That script hits DataSF, BART, FEMA, etc. and writes versioned GeoJSON. Sources that 404/error are skipped with a warning, and `manifest.json` keeps a per-layer ingestion timestamp.

---

## Repo layout

```
.
├── SPEC.md                 ← authoritative spec (read this first)
├── DECISIONS.md            ← log of deviations from SPEC.md
├── README.md               ← this file
├── package.json
├── tsconfig.json           ← strict, noUncheckedIndexedAccess
├── biome.json              ← formatter + linter (replaces ESLint+Prettier)
├── playwright.config.ts
├── vitest.config.ts
├── drizzle.config.ts
├── next.config.ts
├── postcss.config.mjs
├── .env.example
├── db/
│   ├── schema.ts           ← Drizzle schema (SPEC §2.2)
│   └── migrations/0000_init.sql
├── public/
│   └── data/               ← versioned GeoJSON for all 20 layers + manifest.json
├── scripts/
│   ├── extract-v0-data.ts  ← seeds public/data/ from v0 prototype
│   └── ingest-real.ts      ← live ingestion from DataSF/FEMA/BART/etc.
├── src/
│   ├── app/                ← App Router routes + API endpoints
│   │   ├── page.tsx
│   │   ├── home-client.tsx
│   │   ├── about/page.tsx
│   │   ├── compare/{page.tsx,compare-client.tsx}
│   │   └── api/
│   │       ├── concerns/route.ts
│   │       ├── summary/route.ts        ← streaming SSE
│   │       ├── geocode/route.ts
│   │       ├── places/suggest/route.ts
│   │       └── ingest/[source]/route.ts
│   ├── components/
│   │   ├── map/                        ← MapLibre wrapper + layer toggles
│   │   ├── panel/                      ← right-side panel + horizon selector
│   │   ├── search/                     ← autocomplete
│   │   ├── compare/
│   │   └── footer.tsx
│   ├── server/
│   │   ├── concerns/                   ← spatial query → typed concerns
│   │   │   ├── index.ts                ← concernsAt(lat, lng, horizon)
│   │   │   ├── severity.ts             ← SEVERITY_BY_HORIZON tables
│   │   │   └── data-source.ts          ← GeoJSON loader (PostGIS-pluggable)
│   │   ├── llm/
│   │   │   ├── summarize.ts            ← streaming summary + deterministic fallback
│   │   │   └── prompts.ts              ← cached system + methodology blocks
│   │   ├── google/places.ts            ← Places + Geocoding proxy + gazetteer
│   │   └── cache/index.ts              ← Upstash + LRU
│   ├── lib/                            ← geo, url, cn helpers
│   └── types/concern.ts                ← zod-typed Concern + Summary
└── tests/
    ├── unit/                           ← Vitest (severity, geo, concerns, llm, url)
    └── e2e/golden-path.spec.ts         ← Playwright
```

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server with Turbopack |
| `npm run build` | production build |
| `npm run start` | serve the production build |
| `npm run lint` | Biome check + autofix |
| `npm run lint:check` | Biome check (no fixes) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest unit suite |
| `npm run test:e2e` | Playwright golden path (boots dev server if needed) |
| `npm run ingest:all` | hit live data sources, write GeoJSON |
| `npm run db:generate` / `db:migrate` / `db:push` | Drizzle migrations against `DATABASE_URL` |

---

## Deploying

The repo is Vercel-ready:

1. Provision Supabase (Postgres) and enable `postgis`, `pgcrypto`, `pg_trgm` (see `db/migrations/0000_init.sql`).
2. Provision Upstash Redis (free tier is fine).
3. Add the env vars from `.env.example` to your Vercel project. **`VERCEL_CRON_SECRET` is required** to enable `/api/ingest/*`.
4. (Optional) Set up Vercel Cron + GitHub Actions per `SPEC.md` §2.3 for ingestion schedules.
5. Point Cloudflare DNS for `theami.ai` at Vercel (apex + `www`).

Until DB is provisioned, the app reads versioned GeoJSON from `public/data/`. The `LayerProvider` abstraction in `src/server/concerns/data-source.ts` is the swap-point.

---

## Definition of done (from SPEC §13)

| Check | Status |
|---|---|
| Architecture supports all 20 layers | ✓ |
| Every concern card has a working source link | ✓ |
| Vitest unit tests | ✓ 23 tests |
| Playwright golden path | ✓ 4 tests |
| Empty / error / out-of-SF states | ✓ |
| Disclaimer in every page footer | ✓ |
| Print stylesheet renders panel as A4 | ✓ |
| Compare works for 2-4 addresses | ✓ |
| Sentry / PostHog wired | env-driven, ready when keys set |
| Lighthouse ≥ 90 | depends on deploy environment; verify in Vercel preview |
| theami.ai resolving + HTTPS | post-deploy |
| Real-estate agent feedback | post-launch |

The remaining items are deployment-time, not code-time. The codebase is complete.
