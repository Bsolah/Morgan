import { describe, expect, it } from "vitest";
import {
  allocateAttributedAdSpend,
  buildSkuWeeklyTrend,
  isLowConfidenceSku,
  LOW_CONFIDENCE_ORDER_THRESHOLD,
  rankSkusByContributionProfit,
  summarizeSkuWindow,
  type SkuWeeklyEconomicsRow,
} from "./sku-economics.js";

const rows: SkuWeeklyEconomicsRow[] = [
  {
    sku: "TEE-BLUE",
    week_start: "2026-06-02",
    orders_count: 12,
    units_sold: 20,
    gross_revenue: 600,
    contribution_margin: 240,
    unit_margin: 12,
    velocity_per_day: 2.86,
    return_rate: 0.05,
  },
  {
    sku: "TEE-BLUE",
    week_start: "2026-06-09",
    orders_count: 10,
    units_sold: 15,
    gross_revenue: 450,
    contribution_margin: 150,
    unit_margin: 10,
    velocity_per_day: 2.14,
    return_rate: 0.1,
  },
  {
    sku: "HAT-RED",
    week_start: "2026-06-02",
    orders_count: 5,
    units_sold: 8,
    gross_revenue: 200,
    contribution_margin: -40,
    unit_margin: -5,
    velocity_per_day: 1.14,
    return_rate: 0.25,
  },
];

describe("sku economics", () => {
  it("flags SKUs with fewer than 30 orders as low confidence", () => {
    expect(LOW_CONFIDENCE_ORDER_THRESHOLD).toBe(30);
    expect(isLowConfidenceSku(29)).toBe(true);
    expect(isLowConfidenceSku(30)).toBe(false);
  });

  it("ranks SKUs by total contribution profit", () => {
    const ranked = rankSkusByContributionProfit(rows, 100);
    expect(ranked.map((row) => row.sku)).toEqual(["TEE-BLUE", "HAT-RED"]);
    expect(ranked[0]?.contribution_margin).toBe(390);
    expect(ranked[0]?.low_confidence).toBe(true);
  });

  it("allocates ad spend proportional to gross revenue", () => {
    expect(allocateAttributedAdSpend(1050, 1250, 1000)).toBe(840);
    expect(allocateAttributedAdSpend(0, 1250, 1000)).toBe(0);
  });

  it("summarizes SKU window metrics", () => {
    const summary = summarizeSkuWindow(rows, "TEE-BLUE", 500, 1250);
    expect(summary).toMatchObject({
      sku: "TEE-BLUE",
      orders_count: 22,
      units_sold: 35,
      contribution_margin: 390,
      low_confidence: true,
    });
  });

  it("builds weekly margin trend for a SKU", () => {
    const trend = buildSkuWeeklyTrend(rows, "TEE-BLUE");
    expect(trend).toHaveLength(2);
    expect(trend[0]?.week_start).toBe("2026-06-02");
    expect(trend[1]?.contribution_margin).toBe(150);
  });
});
