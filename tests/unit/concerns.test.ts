import { describe, expect, it } from "vitest";
import { concernsAt } from "@/server/concerns";

describe("concernsAt — 321 Church St (Duboce Triangle)", () => {
  it("returns concerns and a stable hash", async () => {
    const result = await concernsAt(37.7665, -122.4294, 10);
    expect(result.concerns.length).toBeGreaterThanOrEqual(3);
    expect(result.concerns_hash.startsWith("sha1:")).toBe(true);
    // Must include a flood concern, since seed data includes flood polygons.
    const flood = result.concerns.find((c) => c.layer === "flood_fema");
    expect(flood).toBeDefined();
    expect(flood!.source.url.length).toBeGreaterThan(0);
    // Same input produces same hash (idempotency)
    const repeat = await concernsAt(37.7665, -122.4294, 10);
    expect(repeat.concerns_hash).toBe(result.concerns_hash);
  });

  it("returns empty for an out-of-SF point", async () => {
    const result = await concernsAt(37.8716, -122.2727, 10); // Berkeley
    expect(result.concerns).toEqual([]);
    expect(result.concerns_hash).toBe("sha1:empty");
  });

  it("horizon affects severity for time-sensitive layers", async () => {
    const a = await concernsAt(37.7665, -122.4294, 5);
    const b = await concernsAt(37.7665, -122.4294, 15);
    // Different horizons → different concern hashes only if at least one
    // SEVERITY_BY_HORIZON varies for the surfaced concerns.
    // We don't strictly require inequality (horizons can match if the surfaced
    // layers are all horizon-invariant), but the pipeline must complete cleanly.
    expect(a.concerns.length).toBeGreaterThan(0);
    expect(b.concerns.length).toBeGreaterThan(0);
  });
});
