# CLAUDE.md

Guidance for AI coding agents working in this repo.

## Read this first

The active build is **theami.ai**. Start at **`SPEC.md`** — it is the authoritative product + technical spec and resolves all major architectural questions (stack, data layers, ingestion, LLM pipeline, API contracts, milestones, open questions). When this file and `SPEC.md` disagree, `SPEC.md` wins. Log any deviation in `DECISIONS.md`.

Stack at a glance (from `SPEC.md` §4): Next.js 15 App Router · TypeScript strict · MapLibre GL + MapTiler · Google Places (server-proxied) · Supabase + PostGIS + Drizzle (optional, see `DECISIONS.md` D11) · Claude Sonnet + Haiku with prompt caching · Tailwind v4 + shadcn/ui · Vercel + Cloudflare DNS.

## Repo layout

- Project root — active build. `SPEC.md` is the entry point; code lives under `src/`.
- `v0/` — archived single-file HTML prototype. Background only (see below).
- `CLAUDE.md` — this file.
- `README.md` — getting-started for humans.
- `DECISIONS.md` — log of deviations from `SPEC.md`.

(Earlier the active build lived under `v1/`. The directory was flattened — there is no longer a `v1/` prefix anywhere. Existing `SPEC.md` may still reference `v1/src/` paths in §8; treat those as just `src/`.)

## v0 in one paragraph

`v0/sf-neighborhood-risk-map.html` is a self-contained Leaflet prototype for one specific home search (321 Church St). It runs by opening the file in a browser — no build, no tests. Useful as a **reference for tone, layer choices, and the shape of `concernsAt()`** (see `v0/readme.md` for the product framing and `SPEC.md` §12 for what to reuse vs. cut). Do not port DOM code, hand-encoded geometry, or the hardcoded shortlist. Ignore the doc-internal "v1 / v2" version labels — repo-level `v0/` is the prior generation, the project root is what we're building.
