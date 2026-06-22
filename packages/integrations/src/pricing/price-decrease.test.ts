import { describe, expect, it } from "vitest";
import {
  buildPriceDecreaseEvidence,
  buildPriceDecreaseSuggestion,
  qualifiesForPriceDecrease,
  resolvePeerPriceRangeForSku,
} from "./price-decrease.js";

describe("price-decrease", () => {
  it("qualifies when return rate exceeds category mean + 2σ and price is above median", () => {
    expect(
      qualifiesForPriceDecrease({
        sku: "HOODIE-GRAY-L",
        category: "HOODIE",
        current_price: 65,
        return_rate: 0.18,
        category_mean_return_rate: 0.08,
        category_stddev_return_rate: 0.03,
        category_median_price: 55,
      }),
    ).toBe(true);
  });

  it("suggests a 3-5% decrease or bundle alternative", () => {
    const decrease = buildPriceDecreaseSuggestion({
      sku: "HOODIE-GRAY-L",
      category: "HOODIE",
      current_price: 65,
      return_rate: 0.18,
      category_mean_return_rate: 0.08,
      category_stddev_return_rate: 0.03,
      category_median_price: 55,
    });

    expect(decrease).not.toBeNull();
    expect(["decrease", "bundle"]).toContain(decrease!.strategy);
    if (decrease!.strategy === "decrease") {
      expect(decrease!.decrease_pct).toBeGreaterThanOrEqual(3);
      expect(decrease!.decrease_pct).toBeLessThanOrEqual(5);
    }
  });

  it("suggests bundle when excess return rate is very high", () => {
    const suggestion = buildPriceDecreaseSuggestion({
      sku: "HOODIE-GRAY-L",
      category: "HOODIE",
      current_price: 80,
      return_rate: 0.35,
      category_mean_return_rate: 0.08,
      category_stddev_return_rate: 0.03,
      category_median_price: 55,
    });

    expect(suggestion?.strategy).toBe("bundle");
    expect(suggestion?.suggested_price).toBeNull();
  });

  it("builds evidence with return rate threshold and peer price range", () => {
    const input = {
      sku: "HOODIE-GRAY-L",
      category: "HOODIE",
      current_price: 65,
      return_rate: 0.18,
      category_mean_return_rate: 0.08,
      category_stddev_return_rate: 0.03,
      category_median_price: 55,
      competitor_price_low: 48,
      competitor_price_high: 58,
      competitor_price_source: "category_peers" as const,
    };

    const evidence = buildPriceDecreaseEvidence(input);
    expect(evidence.return_rate_pct).toBe(18);
    expect(evidence.return_rate_threshold_pct).toBe(14);
    expect(evidence.competitor_price_low).toBe(48);
    expect(evidence.competitor_price_source).toBe("category_peers");
  });

  it("derives peer price range from category catalog", () => {
    const range = resolvePeerPriceRangeForSku({
      category: "TEE",
      sku: "TEE-RED",
      categoryRows: [
        { category: "TEE", sku: "TEE-RED", price: 35 },
        { category: "TEE", sku: "TEE-BLUE", price: 29 },
        { category: "TEE", sku: "TEE-GREEN", price: 31 },
        { category: "TEE", sku: "TEE-BLACK", price: 33 },
      ],
    });

    expect(range.source).toBe("category_peers");
    expect(range.low).toBeGreaterThan(0);
    expect(range.high).toBeGreaterThanOrEqual(range.low!);
  });
});
