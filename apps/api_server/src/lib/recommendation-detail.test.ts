import { describe, expect, it } from "vitest";
import { getRecommendationDetail } from "./recommendation-detail.js";

describe("getRecommendationDetail", () => {
  it("returns detail with evidence and calculation citations", () => {
    const detail = getRecommendationDetail("store-1", "rec-001");
    expect(detail).not.toBeNull();
    expect(detail!.description.length).toBeGreaterThan(20);
    expect(detail!.evidence.length).toBeGreaterThanOrEqual(2);
    expect(detail!.calculation.citations.length).toBeGreaterThanOrEqual(2);
    expect(detail!.related.type).toMatch(/^(leak|metric)$/);
    expect(detail!.suggested_deadline).toBeTruthy();
  });

  it("returns null for unknown id", () => {
    expect(getRecommendationDetail("store-1", "missing")).toBeNull();
  });
});
