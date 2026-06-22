import { describe, expect, it } from "vitest";
import { buildPriceIncreaseSuggestion, qualifiesForPriceIncrease } from "./price-increase.js";

describe("price-increase", () => {
  it("qualifies when margin is below target, velocity is rising, and orders >= 30", () => {
    expect(
      qualifiesForPriceIncrease({
        sku: "TEE-BLUE-M",
        current_price: 29,
        margin_rate: 0.25,
        orders_30d: 45,
        velocity_30d: 2.5,
        velocity_90d: 2,
      }),
    ).toBe(true);
  });

  it("caps suggested increase at 5% and returns margin and unit deltas", () => {
    const suggestion = buildPriceIncreaseSuggestion({
      sku: "TEE-BLUE-M",
      current_price: 29,
      margin_rate: 0.25,
      orders_30d: 45,
      velocity_30d: 2.5,
      velocity_90d: 2,
    });

    expect(suggestion).not.toBeNull();
    expect(suggestion!.increase_pct).toBeLessThanOrEqual(5);
    expect(suggestion!.suggested_price).toBeGreaterThan(suggestion!.current_price);
    expect(suggestion!.expected_margin_delta_usd).toBeGreaterThan(0);
    expect(suggestion!.expected_unit_delta).toBeLessThan(0);
    expect(suggestion!.confidence).toBe("high");
  });

  it("marks confidence low when orders are below threshold", () => {
    expect(
      buildPriceIncreaseSuggestion({
        sku: "TEE-BLUE-M",
        current_price: 29,
        margin_rate: 0.25,
        orders_30d: 20,
        velocity_30d: 2.5,
        velocity_90d: 2,
      }),
    ).toBeNull();
  });
});
