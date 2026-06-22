import { describe, expect, it } from "vitest";
import { buildLeakEngineCandidates } from "./engines/leak-engine-candidates.js";
import { buildDeadStockLiquidationCandidates } from "./engines/dead-stock-engine-candidates.js";
import { buildInventoryEngineCandidates } from "./engines/inventory-engine-candidates.js";
import { buildMarketingEngineCandidates } from "./engines/marketing-engine-candidates.js";
import type { SkuInventoryPlanning } from "../inventory/inventory-planning.js";

describe("recommendation engine candidates", () => {
  it("emits leak engine candidates from active profit leaks", () => {
    const candidates = buildLeakEngineCandidates(
      [
        {
          id: "leak-1",
          leak_type: "ad_waste",
          external_key: "meta|cmp-1",
          severity: "critical",
          amount_at_risk_usd: 1200,
          evidence: [{ campaign: "Retargeting", campaign_id: "cmp-1", poas: 0.7, spend_7d: 400 }],
        },
      ],
      "2026-06-19",
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      engine: "leak",
      category: "ad_waste",
      confidence: "high",
      effort: "low",
      impact_low: 1020,
      impact_high: 1380,
    });
  });

  it("emits inventory reorder candidates for at-risk SKUs", () => {
    const sku: SkuInventoryPlanning = {
      sku: "TEE-BLUE-M",
      title: "Blue Tee",
      available_units: 8,
      velocity_per_day: 5,
      gross_revenue: 3000,
      days_of_stock: 6,
      health_status: "warning",
      stockout_risk: true,
      overstock: false,
      overstock_value_usd: 0,
      lead_time_days: 10,
      safety_stock_units: 20,
      reorder_point_units: 90,
      reorder_cost_usd: 960,
      runway_impact_days: 2.4,
      revenue_rank: 1,
      reorder_recommended: true,
      reorder_qty: 120,
      reorder_by_day: "2026-06-22",
      recommendation_title: "Reorder TEE-BLUE-M",
      recommendation_body: "Place a PO for 120 units by 2026-06-22.",
      observed_velocity_per_day: 2,
      forecasted_velocity_per_day: 5,
      forecast_model: "moving_average",
      forecast_units_30d: 150,
      planning_velocity_per_day: 5,
    };

    const candidates = buildInventoryEngineCandidates([sku], "2026-06-19");
    expect(candidates.some((row) => row.category === "inventory_reorder")).toBe(true);
    expect(candidates[0]?.similarity_hash).toBe("inventory_reorder:tee-blue-m");
    expect(candidates[0]?.evidence[0]).toMatchObject({
      sku: "TEE-BLUE-M",
      reorder_qty: 120,
      reorder_cost_usd: 960,
      runway_impact_days: 2.4,
    });
  });

  it("builds dead stock liquidation candidates from active dead_stock leaks", () => {
    const candidates = buildDeadStockLiquidationCandidates(
      [
        {
          id: "leak-dead-1",
          amount_at_risk_usd: 5000,
          evidence: {
            sku: "HOODIE-GRAY-L",
            title: "Gray Hoodie (L)",
            days_of_stock: 200,
            velocity_30d: 0.2,
            velocity_90d: 0.8,
            available_units: 120,
            inventory_value_usd: 5000,
            suggested_action: "liquidate",
          },
        },
      ],
      "2026-06-19",
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      engine: "inventory",
      category: "inventory_liquidate",
      effort: "high",
      subject_sku: "HOODIE-GRAY-L",
    });
    expect(candidates[0]?.evidence[0]).toMatchObject({
      strategy: expect.stringMatching(/^(discount|bundle|pause_reorders)$/),
      cash_recovered_high_usd: expect.any(Number),
      margin_sacrificed_high_usd: expect.any(Number),
    });
  });

  it("emits marketing budget reallocation candidates", () => {
    const dailyRows = [];
    for (let day = 1; day <= 30; day += 1) {
      const dayStr = `2026-06-${String(day).padStart(2, "0")}`;
      dailyRows.push({
        channel: "meta",
        campaign_id: "cmp-low",
        campaign_name: "Retargeting",
        day: dayStr,
        ad_spend: 100,
        attributed_revenue: 80,
        attributed_contribution_margin: 50,
      });
      dailyRows.push({
        channel: "meta",
        campaign_id: "cmp-high",
        campaign_name: "Prospecting",
        day: dayStr,
        ad_spend: 120,
        attributed_revenue: 480,
        attributed_contribution_margin: 360,
      });
    }

    const candidates = buildMarketingEngineCandidates({
      campaigns: [
        {
          channel: "meta",
          campaign_id: "cmp-low",
          campaign_name: "Retargeting",
          ad_spend: 3000,
          attributed_revenue: 2400,
          attributed_contribution_margin: 1500,
          poas: 0.5,
        },
        {
          channel: "meta",
          campaign_id: "cmp-high",
          campaign_name: "Prospecting",
          ad_spend: 3600,
          attributed_revenue: 14400,
          attributed_contribution_margin: 10800,
          poas: 3,
        },
      ],
      dailyRows,
      referenceDay: "2026-06-30",
    });

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]).toMatchObject({
      engine: "marketing",
      category: "budget_reallocation",
      effort: "low",
    });
    expect(candidates[0]?.evidence[0]).toMatchObject({
      from_campaign_id: expect.any(String),
      to_campaign_id: expect.any(String),
      projected_profit_delta_monthly_usd: expect.any(Number),
    });
  });
});
