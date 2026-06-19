import { describe, expect, it } from "vitest";
import {
  buildMarginPeriodTotals,
  computeMarginDrivers,
  estimateRefundsUsd,
} from "./margin-decomposition.js";

describe("margin decomposition", () => {
  it("ranks COGS as top driver when it increased the most", () => {
    const current = buildMarginPeriodTotals({
      gross_revenue: 100_000,
      discounts: 5_000,
      cogs: 45_000,
      ad_spend: 8_000,
      shipping_revenue: 4_000,
      shipping_cost_pct: 8,
      contribution_margin: 30_000,
    });
    const prior = buildMarginPeriodTotals({
      gross_revenue: 95_000,
      discounts: 4_500,
      cogs: 35_000,
      ad_spend: 7_000,
      shipping_revenue: 3_800,
      shipping_cost_pct: 8,
      contribution_margin: 32_000,
    });

    const drivers = computeMarginDrivers(current, prior, 30);
    expect(drivers[0]?.category).toBe("cogs");
    expect(drivers[0]?.impact_usd).toBeLessThan(0);
    expect(drivers.length).toBeLessThanOrEqual(3);
  });

  it("estimates refunds from residual margin drag", () => {
    const refunds = estimateRefundsUsd({
      gross_revenue: 10_000,
      discounts: 500,
      cogs: 4_000,
      ad_spend: 1_000,
      shipping_cost: 200,
      contribution_margin: 3_000,
    });
    expect(refunds).toBe(1_300);
  });
});
