import { suggest } from "@/server/google/places";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const q = z
    .string()
    .min(2)
    .max(100)
    .safeParse(url.searchParams.get("q") ?? "");
  if (!q.success) return NextResponse.json({ items: [] });
  try {
    const items = await suggest(q.data);
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[places/suggest]", err);
    return NextResponse.json({ items: [], error: (err as Error).message }, { status: 500 });
  }
}
