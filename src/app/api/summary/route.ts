import { cacheGet, cacheSet } from "@/server/cache";
import { streamSummary } from "@/server/llm/summarize";
import { AddressZ, ConcernZ, HorizonZ, type Summary } from "@/types/concern";
import ngeohash from "ngeohash";
import { z } from "zod";

export const runtime = "nodejs";
export const revalidate = 0;

const bodySchema = z.object({
  address: AddressZ,
  horizon: HorizonZ,
  concerns: z.array(ConcernZ),
  concerns_hash: z.string(),
  mode: z.enum(["production", "fast"]).optional(),
});

export async function POST(req: Request): Promise<Response> {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "invalid body", details: parsed.error.flatten() }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const { address, horizon, concerns, concerns_hash, mode = "production" } = parsed.data;

  const geohash8 = ngeohash.encode(address.lat, address.lng, 8);
  const cacheKey = `summary:v1:${geohash8}:${horizon}:${concerns_hash}`;
  const cached = await cacheGet<Summary>(cacheKey);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        if (cached) {
          // Replay deterministic chunks from the cache.
          controller.enqueue(
            enc.encode(`data: ${JSON.stringify({ type: "headline", value: cached.headline })}\n\n`),
          );
          for (const b of cached.bullets) {
            controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "bullet", value: b })}\n\n`));
          }
          controller.enqueue(
            enc.encode(`data: ${JSON.stringify({ type: "outlook", value: cached.outlook })}\n\n`),
          );
          controller.enqueue(
            enc.encode(`data: ${JSON.stringify({ type: "verdict", value: cached.verdict })}\n\n`),
          );
          controller.enqueue(enc.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        // Stream from the model and accumulate to cache when complete.
        const final: Partial<Summary> & { bullets: NonNullable<Summary["bullets"]> } = { bullets: [] };
        for await (const chunk of streamSummary({ address, horizon, concerns }, mode)) {
          controller.enqueue(enc.encode(chunk));
          // Parse for caching
          const m = chunk.match(/^data: (.+)\n\n$/);
          if (m?.[1] && m[1] !== "[DONE]") {
            try {
              const e = JSON.parse(m[1]) as { type: string; value: unknown };
              if (e.type === "headline") final.headline = e.value as string;
              else if (e.type === "bullet") final.bullets.push(e.value as Summary["bullets"][number]);
              else if (e.type === "outlook") final.outlook = e.value as string;
              else if (e.type === "verdict") final.verdict = e.value as Summary["verdict"];
            } catch {
              /* ignore */
            }
          }
        }
        if (final.headline && final.outlook && final.verdict) {
          await cacheSet(cacheKey, final as Summary, 60 * 60 * 24);
        }
        controller.close();
      } catch (err) {
        controller.enqueue(
          enc.encode(`data: ${JSON.stringify({ type: "error", value: (err as Error).message })}\n\n`),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
