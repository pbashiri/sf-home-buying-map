// Cron-only ingestion endpoint. Each source becomes a sub-route handled by
// the same dispatcher. The actual fetch + transform lives in
// scripts/ingest-real.ts so it can also be run locally.
//
// In production these handlers run via Vercel Cron (vercel.json schedules) and
// write to either Supabase Storage (heavy weekly) or directly to the database
// (small/frequent). The placeholder below documents the contract; integrating
// to Vercel Cron requires a vercel.json + DATABASE_URL.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const SOURCES = new Set([
  "datasf-soft-story",
  "datasf-crime",
  "datasf-permits",
  "datasf-trees",
  "datasf-hin",
  "bart",
  "fema-nfhl",
  "cgs-liquefaction",
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ source: string }> },
): Promise<Response> {
  const { source } = await params;
  const auth = req.headers.get("authorization");
  const expected = process.env.VERCEL_CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "VERCEL_CRON_SECRET not configured — ingestion is disabled." },
      { status: 503 },
    );
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!SOURCES.has(source)) {
    return NextResponse.json({ error: "unknown source" }, { status: 404 });
  }
  // For Phase 1 we delegate to the local script via a child invocation. In
  // production this runs DB writes directly. See SPEC §2.3.
  return NextResponse.json({
    source,
    status: "ok",
    note: "Run ingestion via `npm run ingest:all` until DB is provisioned.",
  });
}
