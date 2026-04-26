import { getPostHogClient } from "@/lib/posthog-server";
import { cacheGet, cacheSet } from "@/server/cache";
import { geocode } from "@/server/google/places";
import { AddressZ } from "@/types/concern";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const revalidate = 0;

const bodySchema = z.object({ place_id: z.string() });

export async function POST(req: Request): Promise<Response> {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const cacheKey = `geocode:v1:${parsed.data.place_id}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    const ok = AddressZ.safeParse(cached);
    if (ok.success) return NextResponse.json(ok.data, { headers: { "X-Cache": "HIT" } });
  }
  try {
    const result = await geocode(parsed.data.place_id);
    if (!result) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    await cacheSet(cacheKey, result, 60 * 60 * 24 * 30); // 30 days
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: "server",
      event: "address_geocoded",
      properties: { neighborhood: result.neighborhood, cache: "MISS" },
    });
    return NextResponse.json(result, { headers: { "X-Cache": "MISS" } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
