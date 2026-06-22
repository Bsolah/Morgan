import { describe, expect, it, beforeEach } from "vitest";
import { resetAlertsStore, getPushLog, wasPushSent } from "./alerts-store.js";
import {
  STOCKOUT_THRESHOLDS,
  buildStockoutAlert,
  evaluateStockoutAlerts,
  qualifiesForStockoutAlert,
  stockoutRiskThresholdDays,
  stockoutSeverity,
  type SkuInventoryMetrics,
} from "./stockout-alert-engine.js";

const qualifyingSku = (): SkuInventoryMetrics => ({
  sku_id: "sku_blue_tee_m",
  sku_name: "Blue Tee (M)",
  days_of_stock: 6,
  lead_time_days: 10,
  revenue_percentile: 92,
  recommendation_id: "rec-002",
});

describe("stockout alert engine", () => {
  beforeEach(() => {
    resetAlertsStore();
  });

  it("fires when days-of-stock < lead_time + 3 for top 20% SKU", () => {
    const metrics = qualifyingSku();
    expect(stockoutRiskThresholdDays(metrics.lead_time_days)).toBe(13);
    expect(qualifiesForStockoutAlert(metrics)).toBe(true);

    const alert = buildStockoutAlert("store-1", metrics);
    expect(alert).not.toBeNull();
  });

  it("does not fire for SKUs outside top 20% revenue", () => {
    const metrics = { ...qualifyingSku(), revenue_percentile: 75 };
    expect(qualifiesForStockoutAlert(metrics)).toBe(false);
    expect(buildStockoutAlert("store-1", metrics)).toBeNull();
  });

  it("does not fire when days-of-stock meets reorder window", () => {
    const metrics = { ...qualifyingSku(), days_of_stock: 13 };
    expect(qualifiesForStockoutAlert(metrics)).toBe(false);
  });

  it("includes SKU name, days remaining, and reorder recommendation link", () => {
    const alert = buildStockoutAlert("store-1", qualifyingSku())!;

    expect(alert.title).toContain("Blue Tee (M)");
    expect(alert.magnitude).toContain("6 days remaining");
    expect(alert.body).toContain("Blue Tee (M)");
    expect(alert.links.recommendation).toBe("/recommendations/rec-002");
    expect(alert.metric_snapshot).toMatchObject({
      sku_name: "Blue Tee (M)",
      days_of_stock: 6,
      recommendation_id: "rec-002",
    });
  });

  it("uses warning severity when days remaining < 7", () => {
    expect(stockoutSeverity(6)).toBe("warning");
    const alert = buildStockoutAlert("store-1", qualifyingSku())!;
    expect(alert.severity).toBe("warning");
  });

  it("uses critical severity when days remaining < 3", () => {
    expect(stockoutSeverity(2)).toBe("critical");

    const alert = buildStockoutAlert("store-1", {
      ...qualifyingSku(),
      days_of_stock: 2,
    })!;

    expect(alert.severity).toBe("critical");
  });

  it("sends push for warning+ when enabled", async () => {
    const alerts = await evaluateStockoutAlerts(null, "store-1", [qualifyingSku()]);
    expect(alerts).toHaveLength(1);
    expect(wasPushSent(alerts[0]!.id)).toBe(true);
    expect(getPushLog()).toHaveLength(1);
  });

  it("does not duplicate alerts for the same SKU", async () => {
    await evaluateStockoutAlerts(null, "store-1", [qualifyingSku()]);
    await evaluateStockoutAlerts(null, "store-1", [qualifyingSku()]);
    expect(getPushLog()).toHaveLength(1);
  });

  it("respects threshold constants", () => {
    expect(STOCKOUT_THRESHOLDS.top_revenue_percentile).toBe(80);
    expect(STOCKOUT_THRESHOLDS.lead_time_buffer_days).toBe(3);
    expect(STOCKOUT_THRESHOLDS.warning_days).toBe(7);
    expect(STOCKOUT_THRESHOLDS.critical_days).toBe(3);
  });
});
