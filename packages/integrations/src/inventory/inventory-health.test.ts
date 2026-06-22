import { describe, expect, it } from "vitest";
import {
  buildSkuInventoryHealth,
  computeDaysOfStock,
  computeSafetyStockFromDemand,
  inventoryHealthStatus,
  summarizeInventoryHealth,
} from "./inventory-health.js";

describe("inventory-health", () => {
  it("computes days of stock from available units and velocity", () => {
    expect(computeDaysOfStock(70, 10)).toBe(7);
    expect(computeDaysOfStock(10, 0)).toBeNull();
  });

  it("assigns health status thresholds", () => {
    expect(inventoryHealthStatus(5)).toBe("critical");
    expect(inventoryHealthStatus(10)).toBe("warning");
    expect(inventoryHealthStatus(20)).toBe("healthy");
  });

  it("builds reorder recommendation for low-stock SKUs", () => {
    const sku = buildSkuInventoryHealth(
      {
        sku: "TEE-BLUE",
        available_units: 35,
        velocity_per_day: 5,
        gross_revenue: 1200,
        unit_cost: 8,
      },
      "2026-06-17",
    );

    expect(sku.stockout_risk).toBe(true);
    expect(sku.reorder_recommended).toBe(true);
    expect(sku.reorder_qty).toBeGreaterThan(0);
    expect(sku.lead_time_days).toBe(14);
    expect(sku.safety_stock_units).toBeGreaterThan(0);
    expect(sku.reorder_point_units).toBeGreaterThan(0);
  });

  it("uses custom lead time for reorder and safety stock", () => {
    const sku = buildSkuInventoryHealth(
      {
        sku: "TEE-BLUE",
        available_units: 35,
        velocity_per_day: 5,
        gross_revenue: 1200,
        unit_cost: 8,
      },
      "2026-06-17",
      21,
    );

    expect(sku.lead_time_days).toBe(21);
    expect(sku.safety_stock_units).toBe(
      computeSafetyStockFromDemand({
        avg_daily_velocity: 5,
        lead_time_days: 21,
      }),
    );
    expect(sku.reorder_by_day).not.toBeNull();
  });

  it("summarizes stockout and overstock counts", () => {
    const summary = summarizeInventoryHealth([
      buildSkuInventoryHealth(
        { sku: "A", available_units: 10, velocity_per_day: 2, gross_revenue: 100, unit_cost: 5 },
        "2026-06-17",
      ),
      buildSkuInventoryHealth(
        { sku: "B", available_units: 500, velocity_per_day: 1, gross_revenue: 200, unit_cost: 10 },
        "2026-06-17",
      ),
    ]);

    expect(summary.stockout_risk_count).toBeGreaterThanOrEqual(1);
    expect(summary.overstock_count).toBeGreaterThanOrEqual(1);
  });
});
