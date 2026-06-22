import { describe, expect, it } from "vitest";
import {
  INVENTORY_PURCHASE_RUNWAY_WARNING_DAYS,
  runInventoryPurchaseScenarioForecast,
} from "./inventory-purchase-scenario.js";

describe("runInventoryPurchaseScenarioForecast", () => {
  it("projects runway, stockout date, and expected profit", () => {
    const result = runInventoryPurchaseScenarioForecast({
      sku: "TEE-BLUE",
      title: "Blue Tee",
      quantity: 500,
      unit_cost_usd: 12,
      available_units: 80,
      velocity_per_day: 4,
      unit_margin_usd: 18.5,
      runway_days_baseline: 60,
      avg_daily_net_outflow: 1000,
      reference_day: "2026-06-16",
    });

    expect(result).not.toBeNull();
    expect(result!.purchase_cost_usd).toBe(6000);
    expect(result!.expected_profit_usd).toBe(9250);
    expect(result!.runway_days_after_purchase).toBe(54);
    expect(result!.runway_warning).toBe(false);
    expect(result!.stockout_date_after_purchase).toBe("2026-11-08");
    expect(result!.days_of_stock_after_purchase).toBe(145);
  });

  it("flags runway warning below threshold", () => {
    const result = runInventoryPurchaseScenarioForecast({
      sku: "TEE-BLUE",
      quantity: 1000,
      unit_cost_usd: 20,
      available_units: 50,
      velocity_per_day: 3,
      unit_margin_usd: 15,
      runway_days_baseline: 35,
      avg_daily_net_outflow: 800,
      reference_day: "2026-06-16",
    });

    expect(result!.runway_days_after_purchase).toBe(10);
    expect(result!.runway_warning).toBe(true);
    expect(result!.runway_warning_threshold_days).toBe(INVENTORY_PURCHASE_RUNWAY_WARNING_DAYS);
  });

  it("returns null for invalid input", () => {
    expect(
      runInventoryPurchaseScenarioForecast({
        sku: "",
        quantity: 100,
        unit_cost_usd: 10,
        available_units: 0,
        velocity_per_day: 1,
        runway_days_baseline: 30,
        avg_daily_net_outflow: 500,
        reference_day: "2026-06-16",
      }),
    ).toBeNull();
  });

  it("handles missing margin and zero velocity", () => {
    const result = runInventoryPurchaseScenarioForecast({
      sku: "NEW-SKU",
      quantity: 200,
      unit_cost_usd: 8,
      available_units: 0,
      velocity_per_day: 0,
      unit_margin_usd: null,
      runway_days_baseline: null,
      avg_daily_net_outflow: null,
      reference_day: "2026-06-16",
    });

    expect(result!.expected_profit_usd).toBeNull();
    expect(result!.stockout_date_after_purchase).toBeNull();
    expect(result!.runway_days_after_purchase).toBeNull();
    expect(result!.runway_warning).toBe(false);
  });
});
