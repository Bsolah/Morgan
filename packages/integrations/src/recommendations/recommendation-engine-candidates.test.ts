import { describe, expect, it } from "vitest";
import { buildLeakEngineCandidates } from "./engines/leak-engine-candidates.js";
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
  });

  it("emits marketing budget reallocation candidates", () => {
    const candidates = buildMarketingEngineCandidates(
      [
        {
          channel: "meta",
          campaign_id: "cmp-low",
          campaign_name: "Retargeting",
          ad_spend: 400,
          attributed_revenue: 300,
          attributed_contribution_margin: 200,
          poas: 0.5,
        },
        {
          channel: "meta",
          campaign_id: "cmp-high",
          campaign_name: "Prospecting",
          ad_spend: 600,
          attributed_revenue: 1800,
          attributed_contribution_margin: 1500,
          poas: 2.5,
        },
      ],
      "2026-06-19",
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      engine: "marketing",
      category: "budget_reallocation",
      effort: "low",
    });
  });
});
