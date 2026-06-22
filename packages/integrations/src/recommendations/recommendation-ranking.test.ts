import { describe, expect, it } from "vitest";
import {
  computeImpactRange,
  computeRecommendationRankScore,
  DEFAULT_RANKING_WEIGHTS,
  effortForLeakType,
  recommendationExpiresAt,
  scoreRecommendationCandidate,
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

  it("applies configurable ranking weights", () => {
    const baseline = scoreRecommendationCandidate({
      impact_low: 1000,
      impact_high: 1000,
      confidence: "high",
      effort: "low",
      urgency: "warning",
      weights: DEFAULT_RANKING_WEIGHTS,
    });
    const weighted = scoreRecommendationCandidate({
      impact_low: 1000,
      impact_high: 1000,
      confidence: "high",
      effort: "low",
      urgency: "warning",
      weights: { impact: 2, confidence: 1, urgency: 1, effort: 1 },
    });

    expect(weighted).toBeGreaterThan(baseline);
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
