import { describe, expect, it } from "vitest";
import {
  AD_WASTE_LEAK_THRESHOLDS,
  evaluateAdWasteLeak,
  hasTrailingSustainedHighPoas,
  projectAdWasteAmountAtRiskUsd,
  type AdWasteLeakEvidence,
} from "./ad-waste-leak.js";
import type { CampaignDailyMetrics } from "./poas.js";

function buildLowPoasCampaignFixture(options?: {
  days?: number;
  spendPerDay?: number;
  marginPerDay?: number;
  startDay?: string;
}): CampaignDailyMetrics[] {
  const days = options?.days ?? 7;
  const spendPerDay = options?.spendPerDay ?? 20;
  const marginPerDay = options?.marginPerDay ?? 10;
  const startDay = options?.startDay ?? "2026-06-01";

  return Array.from({ length: days }, (_, index) => {
    const dayNumber = Number(startDay.slice(-2)) + index;
    const month = startDay.slice(0, 7);
    return {
      campaign_id: "cmp-retargeting",
      campaign_name: "Retargeting BOF",
      day: `${month}-${String(dayNumber).padStart(2, "0")}`,
      ad_spend: spendPerDay,
      attributed_revenue: marginPerDay * 2,
      attributed_contribution_margin: marginPerDay,
    };
  });
}

function buildRecoveringCampaignFixture(): CampaignDailyMetrics[] {
  const lowDays = buildLowPoasCampaignFixture({
    days: 7,
    spendPerDay: 25,
    marginPerDay: 12,
    startDay: "2026-06-01",
  });
  const recoveryDays: CampaignDailyMetrics[] = [
    {
      campaign_id: "cmp-retargeting",
      campaign_name: "Retargeting BOF",
      day: "2026-06-08",
      ad_spend: 25,
      attributed_revenue: 80,
      attributed_contribution_margin: 30,
    },
    {
      campaign_id: "cmp-retargeting",
      campaign_name: "Retargeting BOF",
      day: "2026-06-09",
      ad_spend: 25,
      attributed_revenue: 90,
      attributed_contribution_margin: 35,
    },
    {
      campaign_id: "cmp-retargeting",
      campaign_name: "Retargeting BOF",
      day: "2026-06-10",
      ad_spend: 25,
      attributed_revenue: 100,
      attributed_contribution_margin: 40,
    },
  ];

  return [...lowDays, ...recoveryDays];
}

describe("ad waste leak detection", () => {
  it("projects 30d waste from 7d spend rate when POAS is below 1", () => {
    const spend7d = 700;
    const poas7d = 0.7;
    const waste7d = spend7d * (1 - poas7d);
    const expected = waste7d * (30 / 7);

    expect(projectAdWasteAmountAtRiskUsd(spend7d, poas7d)).toBeCloseTo(expected, 4);
    expect(projectAdWasteAmountAtRiskUsd(spend7d, 1)).toBe(0);
    expect(projectAdWasteAmountAtRiskUsd(0, 0.5)).toBe(0);
  });

  it("creates ad_waste leak when POAS stays below 1 for 7 days and spend is at least $100", () => {
    const rows = buildLowPoasCampaignFixture();
    const evaluation = evaluateAdWasteLeak(rows, "cmp-retargeting", "meta", "2026-06-07");

    expect(evaluation.qualifies).toBe(true);
    expect(evaluation.should_resolve).toBe(false);
    expect(evaluation.amount_at_risk_usd).toBeGreaterThan(0);
    expect(evaluation.evidence).toMatchObject<AdWasteLeakEvidence>({
      channel: "meta",
      campaign: "Retargeting BOF",
      campaign_id: "cmp-retargeting",
      poas: 0.5,
      spend_7d: 140,
    });
  });

  it("does not qualify when 7d spend is below $100", () => {
    const rows = buildLowPoasCampaignFixture({ spendPerDay: 10, marginPerDay: 5 });
    const evaluation = evaluateAdWasteLeak(rows, "cmp-retargeting", "meta", "2026-06-07");

    expect(evaluation.qualifies).toBe(false);
    expect(evaluation.amount_at_risk_usd).toBe(0);
  });

  it("does not qualify with only six consecutive low POAS days", () => {
    const rows = buildLowPoasCampaignFixture({ days: 6 });
    const evaluation = evaluateAdWasteLeak(rows, "cmp-retargeting", "meta", "2026-06-06");

    expect(evaluation.qualifies).toBe(false);
  });

  it("auto-resolves after POAS is at or above 1 for 3 consecutive spend days", () => {
    const rows = buildRecoveringCampaignFixture();

    expect(
      hasTrailingSustainedHighPoas(
        rows,
        "cmp-retargeting",
        AD_WASTE_LEAK_THRESHOLDS.resolve_consecutive_high_poas_days,
        AD_WASTE_LEAK_THRESHOLDS.poas_threshold,
        "2026-06-10",
      ),
    ).toBe(true);

    const evaluation = evaluateAdWasteLeak(rows, "cmp-retargeting", "meta", "2026-06-10");
    expect(evaluation.qualifies).toBe(false);
    expect(evaluation.should_resolve).toBe(true);
  });

  it("keeps leak active when recovery streak is incomplete", () => {
    const rows = buildRecoveringCampaignFixture().slice(0, 8);
    const evaluation = evaluateAdWasteLeak(rows, "cmp-retargeting", "meta", "2026-06-08");

    expect(evaluation.qualifies).toBe(false);
    expect(evaluation.should_resolve).toBe(false);
  });
});
