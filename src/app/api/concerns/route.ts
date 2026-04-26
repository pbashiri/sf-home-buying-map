import { getPostHogClient } from "@/lib/posthog-server";
import { cacheGet, cacheSet } from "@/server/cache";
import { concernsAt } from "@/server/concerns";
import { type ConcernsResponse, ConcernsResponseZ, HorizonZ } from "@/types/concern";
import { NextResponse } from "next/server";
import ngeohash from "ngeohash";
import { z } from "zod";

export const runtime = "nodejs";
export const revalidate = 0;

const querySchema = z.object({
  lat: z.string().transform((v) => Number.parseFloat(v)),
  lng: z.string().transform((v) => Number.parseFloat(v)),
  horizon: z
    .string()
    .transform((v) => Number.parseInt(v, 10))
    .pipe(HorizonZ),
});

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    lat: url.searchParams.get("lat") ?? "",
    lng: url.searchParams.get("lng") ?? "",
    horizon: url.searchParams.get("horizon") ?? "10",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid query", details: parsed.error.flatten() }, { status: 400 });
  }
  const { lat, lng, horizon } = parsed.data;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "invalid coordinates" }, { status: 400 });
  }

  const geohash8 = ngeohash.encode(lat, lng, 8);
  const cacheKey = `concerns:v2:${geohash8}:${horizon}`;
  const cached = await cacheGet<ConcernsResponse>(cacheKey);
  if (cached) {
    const validated = ConcernsResponseZ.safeParse(cached);
    if (validated.success) {
      return NextResponse.json(validated.data, {
        headers: { "X-Cache": "HIT", "Cache-Control": "private, max-age=300" },
      });
    }
  }

  try {
    const result = await concernsAt(lat, lng, horizon);
    await cacheSet(cacheKey, result, 60 * 60 * 24); // 24h
    const posthog = getPostHogClient();
    const severityCounts = result.concerns.reduce<Record<string, number>>((acc, c) => {
      acc[c.severity] = (acc[c.severity] ?? 0) + 1;
      return acc;
    }, {});
    posthog.capture({
      distinctId: "server",
      event: "concerns_fetched",
      properties: {
        horizon,
        neighborhood: result.address.neighborhood,
        total_concerns: result.concerns.length,
        cache: "MISS",
        ...severityCounts,
      },
    });
    return NextResponse.json(result, {
      headers: { "X-Cache": "MISS", "Cache-Control": "private, max-age=300" },
    });
  } catch (err) {
    console.error("[concerns] error:", err);
    return NextResponse.json({ error: "internal", message: (err as Error).message }, { status: 500 });
  }
}
