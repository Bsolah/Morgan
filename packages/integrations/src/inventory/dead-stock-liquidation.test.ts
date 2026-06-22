import { describe, expect, it } from "vitest";
import {
  buildLiquidationSuggestion,
  capLiquidationDiscountPct,
  computeLiquidationImpactRange,
  MAX_LIQUIDATION_DISCOUNT_PCT,
  suggestLiquidationStrategy,
} from "./dead-stock-liquidation.js";

describe("dead-stock-liquidation", () => {
  it("never suggests more than 10% discount in one step", () => {
    expect(capLiquidationDiscountPct(15)).toBe(MAX_LIQUIDATION_DISCOUNT_PCT);
    expect(
      suggestLiquidationStrategy({
        velocity_30d: 0.1,
        days_of_stock: 250,
        available_units: 100,
      }).discount_pct,
    ).toBeLessThanOrEqual(MAX_LIQUIDATION_DISCOUNT_PCT);
  });

  it("suggests bundle, discount, or pause reorders based on dead stock profile", () => {
    expect(
      suggestLiquidationStrategy({
        velocity_30d: 0,
        days_of_stock: 120,
        available_units: 80,
      }).strategy,
    ).toBe("pause_reorders");

    expect(
      suggestLiquidationStrategy({
        velocity_30d: 0.5,
        days_of_stock: 120,
        available_units: 80,
      }).strategy,
    ).toBe("bundle");

    expect(
      suggestLiquidationStrategy({
        velocity_30d: 0.2,
        days_of_stock: 200,
        available_units: 80,
      }).strategy,
    ).toBe("discount");
  });

  it("returns cash recovered and margin sacrificed ranges", () => {
    const impact = computeLiquidationImpactRange({
      inventory_value_usd: 5000,
      strategy: "discount",
      discount_pct: 10,
      velocity_30d: 0.2,
    });

    expect(impact.cash_recovered_high_usd).toBeGreaterThan(impact.cash_recovered_low_usd);
    expect(impact.margin_sacrificed_high_usd).toBeGreaterThan(0);
  });

  it("builds liquidation recommendation copy from dead stock evidence", () => {
    const suggestion = buildLiquidationSuggestion({
      sku: "HOODIE-GRAY-L",
      title: "Gray Hoodie (L)",
      days_of_stock: 200,
      velocity_30d: 0.2,
      velocity_90d: 0.8,
      available_units: 120,
      inventory_value_usd: 3000,
      suggested_action: "liquidate",
    });

    expect(suggestion.title).toContain("HOODIE-GRAY-L");
    expect(suggestion.body.length).toBeGreaterThan(0);
  });
});
