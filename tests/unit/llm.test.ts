import { describe, expect, it } from "vitest";
import { deterministicSummary } from "@/server/llm/summarize";
import type { Concern } from "@/types/concern";

const concerns: Concern[] = [
  {
    id: "c1",
    layer: "flood_fema",
    severity: "alert",
    title: "Inside FEMA SFHA",
    body: "This parcel is in a Special Flood Hazard Area.",
    action: "Price in flood insurance.",
    source: { label: "FEMA NFHL", url: "https://msc.fema.gov/" },
    ingested_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "c2",
    layer: "transit",
    severity: "favor",
    title: "Muni Metro within 400m",
    body: "Walking distance to a Muni surface stop.",
    source: { label: "SFMTA", url: "https://sfmta.com/" },
    ingested_at: "2026-04-01T00:00:00Z",
  },
];

describe("deterministicSummary", () => {
  it("produces all four schema fields", () => {
    const out = deterministicSummary({
      concerns,
      address: { lat: 37.7665, lng: -122.4294, neighborhood: "Duboce Triangle" },
      horizon: 10,
    });
    expect(out.headline.length).toBeGreaterThan(0);
    expect(out.bullets.length).toBeGreaterThan(0);
    expect(out.outlook.toLowerCase()).toContain("10 years");
    expect(["alert", "watch", "neutral", "favor"]).toContain(out.verdict);
  });

  it("verdict is alert when an alert is present", () => {
    const out = deterministicSummary({ concerns, address: { lat: 0, lng: 0 }, horizon: 5 });
    expect(out.verdict).toBe("alert");
  });

  it("every bullet maps to a concern_id from the input", () => {
    const ids = new Set(concerns.map((c) => c.id));
    const out = deterministicSummary({ concerns, address: { lat: 0, lng: 0 }, horizon: 10 });
    for (const b of out.bullets) {
      expect(ids.has(b.concern_id)).toBe(true);
    }
  });
});
