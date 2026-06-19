import { describe, expect, it } from "vitest";
import { computeMarginPct } from "../lib/profit-overview-service.js";

describe("computeMarginPct", () => {
  it("returns margin percentage rounded to one decimal", () => {
    expect(computeMarginPct(400, 1000)).toBe(40);
    expect(computeMarginPct(125, 1000)).toBe(12.5);
  });

  it("returns null when net revenue is zero", () => {
    expect(computeMarginPct(100, 0)).toBeNull();
  });
});
