import { describe, expect, it } from "vitest";
import { compareParse, compareSerialise, decodeAddress, encodeAddress } from "@/lib/url";

describe("URL state encoding", () => {
  it("round-trips a single address", () => {
    const sp = encodeAddress({ lat: 37.7665, lng: -122.4294, horizon: 10, label: "321 Church" });
    const back = decodeAddress(new URLSearchParams(sp.toString()));
    expect(back).toEqual({ lat: 37.7665, lng: -122.4294, horizon: 10, label: "321 Church" });
  });

  it("clamps unknown horizon to 10", () => {
    const back = decodeAddress(new URLSearchParams("lat=37.7&lng=-122.4&h=99"));
    expect(back?.horizon).toBe(10);
  });

  it("compareSerialise / compareParse round-trip", () => {
    const arr = [
      { lat: 37.7665, lng: -122.4294, horizon: 10 as const },
      { lat: 37.7783, lng: -122.4425, horizon: 7 as const },
    ];
    const s = compareSerialise(arr);
    const back = compareParse(s);
    expect(back).toEqual(arr);
  });
});
