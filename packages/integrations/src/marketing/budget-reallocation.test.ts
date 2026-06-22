import { describe, expect, it } from "vitest";
import {
  BUDGET_SHIFT_INCREMENT_USD,
  buildCampaignMarginalPoasCurves,
  buildMarginalPoasCurvePoints,
  simulateBudgetReallocationScenarios,
  toBudgetReallocationScenarioView,
} from "./budget-reallocation.js";
import { solveChannelBudgetLp } from "./channel-budget-lp.js";

describe("budget-reallocation", () => {
  it("returns top scenarios with projected monthly profit above threshold", () => {
    const dailyRows = [];
    for (let day = 1; day <= 30; day += 1) {
      const dayStr = `2026-06-${String(day).padStart(2, "0")}`;
      dailyRows.push({
        channel: "meta",
        campaign_id: "low",
        campaign_name: "Low POAS",
        day: dayStr,
        ad_spend: 100,
        attributed_revenue: 120,
        attributed_contribution_margin: 60,
      });
      dailyRows.push({
        channel: "meta",
        campaign_id: "high",
        campaign_name: "High POAS",
        day: dayStr,
        ad_spend: 150,
        attributed_revenue: 600,
        attributed_contribution_margin: 450,
      });
    }

    const campaigns = [
      {
        channel: "meta",
        campaign_id: "low",
        campaign_name: "Low POAS",
        ad_spend: 3000,
        attributed_revenue: 3600,
        attributed_contribution_margin: 1800,
        poas: 0.6,
      },
      {
        channel: "meta",
        campaign_id: "high",
        campaign_name: "High POAS",
        ad_spend: 4500,
        attributed_revenue: 18000,
        attributed_contribution_margin: 13500,
        poas: 3,
      },
    ];

    const scenarios = simulateBudgetReallocationScenarios({
      campaigns,
      dailyRows,
      windowDays: 30,
      referenceDay: "2026-06-30",
      totalBudgetUsd: 7500,
    });

    expect(scenarios.length).toBeGreaterThan(0);
    expect(scenarios.length).toBeLessThanOrEqual(3);
    expect(scenarios[0]!.amount_usd).toBeGreaterThanOrEqual(BUDGET_SHIFT_INCREMENT_USD);
    expect(scenarios[0]!.projected_profit_delta_monthly_usd).toBeGreaterThan(200);

    const view = toBudgetReallocationScenarioView(scenarios[0]!);
    expect(view.from_campaign).toBe(view.from_campaign_name);
    expect(view.to_campaign).toBe(view.to_campaign_name);
    expect(view.amount).toBe(view.amount_usd);
    expect(view.projected_profit_delta).toBe(view.projected_profit_delta_monthly_usd);

    const curves = buildCampaignMarginalPoasCurves({
      campaigns,
      dailyRows,
      windowDays: 30,
      referenceDay: "2026-06-30",
    });
    expect(curves.length).toBe(2);
    expect(curves[0]!.curve_points.length).toBeGreaterThan(0);

    const points = buildMarginalPoasCurvePoints(dailyRows, "high", 30, "2026-06-30");
    expect(points.length).toBeGreaterThan(0);
    expect(points[0]!.cumulative_spend_usd).toBeGreaterThan(0);
  });
});

describe("channel-budget-lp", () => {
  it("optimizes spend across two connected channels with minimum constraints", () => {
    const result = solveChannelBudgetLp({
      total_budget_usd: 5000,
      min_spend_per_channel_usd: 500,
      channels: [
        {
          channel: "meta",
          ad_spend: 3000,
          attributed_revenue: 9000,
          attributed_contribution_margin: 4500,
          poas: 1.5,
          campaign_count: 2,
        },
        {
          channel: "google_ads",
          ad_spend: 2000,
          attributed_revenue: 10000,
          attributed_contribution_margin: 6000,
          poas: 3,
          campaign_count: 1,
        },
      ],
    });

    expect(result).not.toBeNull();
    expect(result!.solver).toBe("highs_lp");
    expect(result!.recommendations).toHaveLength(2);
    const google = result!.recommendations.find((row) => row.channel === "google_ads");
    expect(google!.recommended_spend_usd).toBeGreaterThan(google!.current_spend_usd);
  });

  it("returns null when fewer than two channels are available", () => {
    expect(
      solveChannelBudgetLp({
        total_budget_usd: 1000,
        channels: [
          {
            channel: "meta",
            ad_spend: 1000,
            attributed_revenue: 3000,
            attributed_contribution_margin: 1500,
            poas: 1.5,
            campaign_count: 1,
          },
        ],
      }),
    ).toBeNull();
  });
});
