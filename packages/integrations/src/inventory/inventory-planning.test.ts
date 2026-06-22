import { describe, expect, it } from "vitest";
import { buildSkuInventoryPlanning, resolvePlanningVelocity } from "./inventory-planning.js";

describe("inventory planning", () => {
  it("prefers forecasted velocity when available", () => {
    expect(
      resolvePlanningVelocity(2, {
        sku: "TEE-BLUE-M",
        model: "moving_average",
        history_days: 60,
        zero_day_ratio: 0,
        avg_daily_units: 5,
        forecast_units_total: 150,
        daily: [],
      }),
    ).toBe(5);
  });

  it("falls back to observed velocity without a forecast", () => {
    expect(resolvePlanningVelocity(2.4, null)).toBe(2.4);
  });

  it("builds reorder guidance from forecasted velocity", () => {
    const planning = buildSkuInventoryPlanning(
      {
        sku: "TEE-BLUE-M",
        available_units: 10,
        velocity_per_day: 1,
        gross_revenue: 1000,
        unit_cost: 12,
        demand_forecast: {
          sku: "TEE-BLUE-M",
          model: "moving_average",
          history_days: 60,
          zero_day_ratio: 0,
          avg_daily_units: 5,
          forecast_units_total: 150,
          daily: [],
        },
      },
      "2026-06-30",
      10,
    );

    expect(planning.forecasted_velocity_per_day).toBe(5);
    expect(planning.planning_velocity_per_day).toBe(5);
    expect(planning.stockout_risk).toBe(true);
    expect(planning.reorder_recommended).toBe(true);
  });
});
