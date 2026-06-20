import { describe, expect, it } from "vitest";
import { getStoreRecommendations } from "./recommendations-feed.js";

describe("getStoreRecommendations", () => {
  it("returns at most 5 open recommendations sorted by rank score", () => {
    const { open } = getStoreRecommendations("store-1");

    expect(open.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < open.length; i++) {
      expect(open[i - 1]!.rank_score).toBeGreaterThanOrEqual(open[i]!.rank_score);
    }
  });

  it("includes required card fields", () => {
    const { open } = getStoreRecommendations("store-1");
    const first = open[0]!;

    expect(first.title).toBeTruthy();
    expect(first.impact_low_usd).toBeGreaterThan(0);
    expect(first.impact_high_usd).toBeGreaterThanOrEqual(first.impact_low_usd);
    expect(["low", "medium", "high"]).toContain(first.effort);
    expect(["low", "medium", "high"]).toContain(first.confidence);
    expect(first.category).toBeTruthy();
    expect(first.expires_at).toBeTruthy();
    expect(first.rank).toBe(1);
  });

  it("reports archived count for items beyond the cap", () => {
    const { archived_count } = getStoreRecommendations("store-1");
    expect(archived_count).toBeGreaterThan(0);
  });
});
