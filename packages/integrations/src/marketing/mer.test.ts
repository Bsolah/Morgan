import { describe, expect, it } from "vitest";
import {
  bucketMerChannelSpend,
  buildMerChannelBreakdown,
  buildMerDailyTrend,
  calculateMer,
  sumAdSpendForMer,
} from "./mer.js";

describe("MER calculations", () => {
  it("calculates MER as ad spend divided by net revenue", () => {
    expect(calculateMer(2500, 10000)).toBe(0.25);
    expect(calculateMer(0, 10000)).toBe(0);
    expect(calculateMer(100, 0)).toBeNull();
  });

  it("includes only Meta spend until Google Ads is connected", () => {
    const rows = [
      { channel: "meta", ad_spend: 100 },
      { channel: "google_ads", ad_spend: 50 },
      { channel: "meta", ad_spend: 25 },
    ];

    expect(sumAdSpendForMer(rows, false)).toBe(125);
    expect(sumAdSpendForMer(rows, true)).toBe(175);
  });

  it("buckets channel spend with google in unattributed until connected", () => {
    const rows = [
      { channel: "meta", ad_spend: 100 },
      { channel: "google_ads", ad_spend: 50 },
      { channel: "other", ad_spend: 10 },
    ];

    expect(bucketMerChannelSpend(rows, false)).toEqual({
      meta: 100,
      google_ads: 0,
      unattributed: 60,
      blended: 100,
    });

    expect(bucketMerChannelSpend(rows, true)).toEqual({
      meta: 100,
      google_ads: 50,
      unattributed: 10,
      blended: 150,
    });
  });

  it("builds channel MER breakdown with google only when connected", () => {
    const spend = bucketMerChannelSpend(
      [
        { channel: "meta", ad_spend: 200 },
        { channel: "google_ads", ad_spend: 100 },
      ],
      true,
    );

    const breakdown = buildMerChannelBreakdown(spend, 1000, true);
    expect(breakdown.map((row) => row.channel)).toEqual(["meta", "google_ads", "unattributed"]);
    expect(breakdown[0]?.mer).toBe(0.2);
    expect(breakdown[1]?.mer).toBe(0.1);
  });

  it("builds daily MER trend with zero-filled days", () => {
    const trend = buildMerDailyTrend({
      adRows: [
        { day: "2026-06-08", channel: "meta", ad_spend: 100 },
        { day: "2026-06-10", channel: "meta", ad_spend: 200 },
      ],
      netRevenueByDay: new Map([
        ["2026-06-08", 1000],
        ["2026-06-10", 2000],
      ]),
      trendDays: 3,
      referenceDay: "2026-06-10",
      googleAdsConnected: false,
    });

    expect(trend).toHaveLength(3);
    expect(trend[0]?.mer).toBe(0.1);
    expect(trend[1]?.ad_spend).toBe(0);
    expect(trend[2]?.mer).toBe(0.1);
  });
});
