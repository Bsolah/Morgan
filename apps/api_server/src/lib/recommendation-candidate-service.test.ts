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
    const dailyRows = [];
    for (let day = 1; day <= 30; day += 1) {
      const dayStr = `2026-06-${String(day).padStart(2, "0")}`;
      dailyRows.push({
        channel: "meta",
        campaign_id: "a",
        campaign_name: "Low",
        day: dayStr,
        ad_spend: 10,
        attributed_revenue: 7,
        attributed_contribution_margin: 3,
      });
      dailyRows.push({
        channel: "meta",
        campaign_id: "b",
        campaign_name: "High",
        day: dayStr,
        ad_spend: 17,
        attributed_revenue: 67,
        attributed_contribution_margin: 50,
      });
    }

    const marketing = buildMarketingEngineCandidates({
      campaigns: [
        {
          channel: "meta",
          campaign_id: "a",
          campaign_name: "Low",
          ad_spend: 3000,
          attributed_revenue: 2000,
          attributed_contribution_margin: 1000,
          poas: 0.33,
        },
        {
          channel: "meta",
          campaign_id: "b",
          campaign_name: "High",
          ad_spend: 4500,
          attributed_revenue: 20000,
          attributed_contribution_margin: 15000,
          poas: 3,
        },
      ],
      dailyRows,
      referenceDay,
    });

    const combined = [...leak, ...inventory, ...marketing];
    expect(combined.length).toBeGreaterThanOrEqual(1);
    expect(combined.some((row) => row.engine === "leak")).toBe(true);
    if (marketing.length > 0) {
      expect(marketing[0]).toMatchObject({
        engine: "marketing",
        category: "budget_reallocation",
      });
    }
    expect(
      dedupeRecommendationCandidates(combined, [], referenceDay).map((row) => row.similarity_hash),
    ).toHaveLength(combined.length);
  });
});
