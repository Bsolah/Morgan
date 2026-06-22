import { describe, expect, it } from "vitest";
import {
  computeImpactRange,
  computeRecommendationRankScore,
  effortForLeakType,
  recommendationExpiresAt,
} from "./recommendation-ranking.js";

describe("recommendation-ranking", () => {
  it("scores higher impact and lower effort recommendations higher", () => {
    const highImpact = computeRecommendationRankScore({
      impactUsd: 1000,
      confidence: "high",
      effort: "low",
      severity: "warning",
    });
    const lowImpact = computeRecommendationRankScore({
      impactUsd: 200,
      confidence: "medium",
      effort: "high",
      severity: "info",
    });

    expect(highImpact).toBeGreaterThan(lowImpact);
  });

  it("derives effort by leak type", () => {
    expect(effortForLeakType("ad_waste")).toBe("low");
    expect(effortForLeakType("dead_stock")).toBe("high");
  });

  it("builds impact range around amount at risk", () => {
    expect(computeImpactRange(1000)).toEqual({
      impact_low_usd: 850,
      impact_high_usd: 1150,
    });
  });

  it("expires recommendations after tomorrow's brief day", () => {
    expect(recommendationExpiresAt("2026-06-19")).toBe("2026-06-20");
  });
});
