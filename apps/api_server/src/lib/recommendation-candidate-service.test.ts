import { describe, expect, it } from "vitest";
import {
  buildInventoryEngineCandidates,
  buildLeakEngineCandidates,
  buildMarketingEngineCandidates,
  dedupeRecommendationCandidates,
} from "@morgan/integrations";

describe("recommendation candidate generation", () => {
  it("combines candidates from leak, inventory, and marketing engines", () => {
    const referenceDay = "2026-06-19";
    const leak = buildLeakEngineCandidates(
      [
        {
          id: "leak-1",
          leak_type: "return_drain",
          external_key: "TEE-BLUE-M",
          severity: "warning",
          amount_at_risk_usd: 500,
          evidence: [{ sku: "TEE-BLUE-M", return_rate_pct: 18 }],
        },
      ],
      referenceDay,
    );
    const inventory = buildInventoryEngineCandidates(
      [
        {
          sku: "HOODIE-L",
          title: null,
          available_units: 5,
          velocity_per_day: 4,
          gross_revenue: 2000,
          days_of_stock: 5,
          health_status: "warning",
          stockout_risk: true,
          overstock: false,
          overstock_value_usd: 0,
          lead_time_days: 14,
          safety_stock_units: 10,
          reorder_recommended: true,
          reorder_qty: 80,
          reorder_by_day: "2026-06-21",
          recommendation_title: "Reorder HOODIE-L",
          recommendation_body: "Reorder soon",
          observed_velocity_per_day: 4,
          forecasted_velocity_per_day: null,
          forecast_model: null,
          forecast_units_30d: null,
          planning_velocity_per_day: 4,
        },
      ],
      referenceDay,
    );
    const marketing = buildMarketingEngineCandidates(
      [
        {
          channel: "meta",
          campaign_id: "a",
          campaign_name: "Low",
          ad_spend: 300,
          attributed_revenue: 200,
          attributed_contribution_margin: 100,
          poas: 0.33,
        },
        {
          channel: "meta",
          campaign_id: "b",
          campaign_name: "High",
          ad_spend: 500,
          attributed_revenue: 2000,
          attributed_contribution_margin: 1500,
          poas: 3,
        },
      ],
      referenceDay,
    );

    const combined = [...leak, ...inventory, ...marketing];
    expect(combined.map((row) => row.engine)).toEqual(["leak", "inventory", "marketing"]);
    expect(
      dedupeRecommendationCandidates(combined, [], referenceDay).map((row) => row.similarity_hash),
    ).toHaveLength(3);
  });
});
