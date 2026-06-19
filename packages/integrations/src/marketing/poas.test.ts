import { describe, expect, it } from "vitest";
import {
  computeContributionMargin,
  extractGclidFromOrderPayload,
  extractUtmFromOrderPayload,
  matchAttributionChannel,
  resolveAttributionChannel,
  DEFAULT_GOOGLE_ADS_ATTRIBUTION_RULES,
  DEFAULT_META_ATTRIBUTION_RULES,
} from "./attribution.js";
import {
  aggregateCampaignWindow,
  buildCampaignDailyTrend,
  calculatePoas,
  calculateRoas,
  hasConsecutiveLowPoasDays,
} from "./poas.js";
import { buildCampaignPoasInputs, summarizeChannelPoas } from "./budget-allocation.js";

describe("marketing attribution", () => {
  it("extracts utm params from landing_site", () => {
    const utm = extractUtmFromOrderPayload({
      landing_site: "https://demo.myshopify.com/products/tee?utm_source=facebook&utm_campaign=retargeting",
    });

    expect(utm.utm_source).toBe("facebook");
    expect(utm.utm_campaign).toBe("retargeting");
  });

  it("matches meta attribution rules", () => {
    const channel = matchAttributionChannel(
      { utm_source: "facebook", utm_campaign: "bof" },
      DEFAULT_META_ATTRIBUTION_RULES,
    );
    expect(channel).toBe("meta");
  });

  it("matches google attribution via utm_source", () => {
    const channel = matchAttributionChannel(
      { utm_source: "google", utm_campaign: "shopping-brand" },
      DEFAULT_GOOGLE_ADS_ATTRIBUTION_RULES,
    );
    expect(channel).toBe("google_ads");
  });

  it("extracts gclid from landing_site", () => {
    const gclid = extractGclidFromOrderPayload({
      landing_site: "https://demo.myshopify.com/?gclid=abc123&utm_source=google",
    });
    expect(gclid).toBe("abc123");
  });

  it("resolves google_ads when gclid is present", () => {
    const channel = resolveAttributionChannel(
      { utm_source: null, utm_campaign: null },
      "abc123",
      DEFAULT_GOOGLE_ADS_ATTRIBUTION_RULES,
    );
    expect(channel).toBe("google_ads");
  });

  it("computes contribution margin with manual cogs pct", () => {
    const margin = computeContributionMargin({
      revenue: 100,
      cogsMethod: "manual_pct",
      manualCogsPct: 40,
      config: {
        cogsMethod: "manual_pct",
        manualCogsPct: 40,
        shippingCostPct: 0,
        paymentFeePct: 0,
        paymentFeeFixedUsd: 0,
      },
    });
    expect(margin).toBe(60);
  });

  it("computes contribution margin with QuickBooks COGS rate", () => {
    const margin = computeContributionMargin({
      revenue: 100,
      cogsMethod: "qbo",
      qboCogsRate: 0.35,
      lineItems: [{ quantity: 1, unitCost: 10 }],
      config: {
        cogsMethod: "qbo",
        accountingCogsRate: 0.35,
        shippingCostPct: 0,
        paymentFeePct: 0,
        paymentFeeFixedUsd: 0,
      },
    });
    expect(margin).toBe(65);
  });
});

describe("poas calculations", () => {
  it("calculates POAS and ROAS", () => {
    expect(calculatePoas(200, 100)).toBe(2);
    expect(calculateRoas(500, 100)).toBe(5);
    expect(calculatePoas(50, 0)).toBeNull();
  });

  it("aggregates campaign window metrics", () => {
    const rows = [
      {
        campaign_id: "1",
        campaign_name: "Retargeting",
        day: "2026-06-10",
        ad_spend: 50,
        attributed_revenue: 200,
        attributed_contribution_margin: 80,
      },
      {
        campaign_id: "1",
        campaign_name: "Retargeting",
        day: "2026-06-11",
        ad_spend: 50,
        attributed_revenue: 100,
        attributed_contribution_margin: 40,
      },
    ];

    const aggregated = aggregateCampaignWindow(rows, 7, "2026-06-11");
    const campaign = aggregated.get("1");
    expect(campaign?.ad_spend).toBe(100);
    expect(campaign?.poas).toBe(1.2);
    expect(campaign?.roas).toBe(3);
  });

  it("flags seven consecutive low POAS days", () => {
    const rows = Array.from({ length: 7 }, (_, index) => ({
      campaign_id: "cmp-1",
      campaign_name: "Retargeting",
      day: `2026-06-${String(index + 1).padStart(2, "0")}`,
      ad_spend: 100,
      attributed_revenue: 120,
      attributed_contribution_margin: 50,
    }));

    expect(hasConsecutiveLowPoasDays(rows, "cmp-1", 7, 1)).toBe(true);
  });
});

describe("budget allocation inputs", () => {
  it("builds per-campaign POAS inputs grouped by channel", () => {
    const rows = [
      {
        channel: "google_ads",
        campaign_id: "1",
        campaign_name: "Shopping",
        day: "2026-06-10",
        ad_spend: 100,
        attributed_revenue: 300,
        attributed_contribution_margin: 120,
      },
      {
        channel: "meta",
        campaign_id: "2",
        campaign_name: "Retargeting",
        day: "2026-06-10",
        ad_spend: 50,
        attributed_revenue: 200,
        attributed_contribution_margin: 80,
      },
    ];

    const campaigns = buildCampaignPoasInputs(rows, 7, "2026-06-10");
    expect(campaigns).toHaveLength(2);
    expect(campaigns[0]?.channel).toBe("meta");
    expect(campaigns[0]?.poas).toBe(1.6);

    const channels = summarizeChannelPoas(campaigns);
    expect(channels).toHaveLength(2);
    expect(channels.find((row) => row.channel === "google_ads")?.poas).toBe(1.2);
  });

  it("builds daily spend and POAS trend with zero-filled days", () => {
    const trend = buildCampaignDailyTrend(
      [
        {
          campaign_id: "1",
          campaign_name: "Prospecting",
          day: "2026-06-08",
          ad_spend: 100,
          attributed_revenue: 300,
          attributed_contribution_margin: 50,
        },
        {
          campaign_id: "1",
          campaign_name: "Prospecting",
          day: "2026-06-10",
          ad_spend: 200,
          attributed_revenue: 600,
          attributed_contribution_margin: 100,
        },
      ],
      3,
      "2026-06-10",
    );

    expect(trend).toHaveLength(3);
    expect(trend[0]).toMatchObject({ day: "2026-06-08", ad_spend: 100, poas: 0.5 });
    expect(trend[1]).toMatchObject({ day: "2026-06-09", ad_spend: 0, poas: null });
    expect(trend[2]).toMatchObject({ day: "2026-06-10", ad_spend: 200, poas: 0.5 });
  });
});
