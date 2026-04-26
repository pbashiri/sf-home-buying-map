import { describe, expect, it } from "vitest";
import { SEVERITY_BY_HORIZON, severityFor } from "@/server/concerns/severity";

describe("severity tables", () => {
  it("FEMA SFHA is alert at every horizon", () => {
    for (const h of [5, 7, 10, 15] as const) {
      expect(severityFor("flood.fema_sfha", h)).toBe("alert");
    }
  });

  it("NOAA SLR 3ft scenario escalates with horizon", () => {
    expect(severityFor("flood.slr_3ft", 5)).toBe("context");
    expect(severityFor("flood.slr_3ft", 10)).toBe("watch");
    expect(severityFor("flood.slr_3ft", 15)).toBe("alert");
  });

  it("Construction permits demote with longer horizon", () => {
    expect(severityFor("construction.permit_within_500ft.active", 5)).toBe("alert");
    expect(severityFor("construction.permit_within_500ft.active", 10)).toBe("watch");
    expect(severityFor("construction.permit_within_500ft.active", 15)).toBe("context");
  });

  it("BART within 800m is favor at all horizons", () => {
    for (const h of [5, 7, 10, 15] as const) {
      expect(severityFor("transit.bart_within_800m", h)).toBe("favor");
    }
  });

  it("Every key has all four horizons covered", () => {
    for (const key of Object.keys(SEVERITY_BY_HORIZON)) {
      const tbl = SEVERITY_BY_HORIZON[key as keyof typeof SEVERITY_BY_HORIZON];
      for (const h of [5, 7, 10, 15] as const) {
        expect(tbl[h]).toBeDefined();
      }
    }
  });
});
