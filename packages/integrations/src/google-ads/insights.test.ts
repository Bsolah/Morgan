import { describe, expect, it } from "vitest";
import { normalizeGoogleAdsCustomerId } from "./api.js";
import { buildGoogleAdsAuthorizeUrl, GOOGLE_ADS_SCOPE } from "./oauth.js";
import { chunkDateRange, parseGoogleAdsCampaignDailyRows, parseGoogleAdsShoppingProductDailyRows } from "./insights.js";

describe("google ads oauth", () => {
  it("builds authorize url with adwords scope and offline access", () => {
    const url = buildGoogleAdsAuthorizeUrl({
      clientId: "client-id",
      redirectUri: "http://localhost:8080/callback",
      state: "abc123",
    });

    expect(url).toContain("accounts.google.com/o/oauth2/v2/auth");
    expect(url).toContain(encodeURIComponent(GOOGLE_ADS_SCOPE));
    expect(url).toContain("access_type=offline");
    expect(url).toContain("prompt=consent");
  });
});

describe("google ads api helpers", () => {
  it("normalizes customer resource names", () => {
    expect(normalizeGoogleAdsCustomerId("customers/1234567890")).toBe("1234567890");
    expect(normalizeGoogleAdsCustomerId("123-456-7890")).toBe("1234567890");
  });
});

describe("google ads insights helpers", () => {
  it("parses campaign daily rows", () => {
    const rows = parseGoogleAdsCampaignDailyRows([
      {
        campaign: { id: "1", name: "Search Brand" },
        metrics: {
          costMicros: 2_500_000,
          impressions: 1000,
          clicks: 50,
          conversions: 3,
          conversionsValue: 120,
        },
        segments: { date: "2026-06-01" },
      },
    ]);

    expect(rows).toEqual([
      {
        day: "2026-06-01",
        campaign_id: "1",
        campaign_name: "Search Brand",
        cost: 2.5,
        impressions: 1000,
        clicks: 50,
        conversions: 3,
        conversion_value: 120,
      },
    ]);
  });

  it("chunks date ranges", () => {
    expect(chunkDateRange("2026-06-01", "2026-06-10", 7)).toEqual([
      { since: "2026-06-01", until: "2026-06-07" },
      { since: "2026-06-08", until: "2026-06-10" },
    ]);
  });

  it("parses shopping product daily rows", () => {
    const rows = parseGoogleAdsShoppingProductDailyRows([
      {
        campaign: { id: "9", name: "Shopping Feed" },
        metrics: {
          costMicros: 1_000_000,
          impressions: 500,
          clicks: 20,
          conversions: 2,
          conversionsValue: 80,
        },
        segments: {
          date: "2026-06-02",
          productItemId: "sku-123",
          productTitle: "Blue Tee",
        },
      },
    ]);

    expect(rows[0]).toMatchObject({
      day: "2026-06-02",
      campaign_id: "9",
      product_item_id: "sku-123",
      product_title: "Blue Tee",
      cost: 1,
      conversions: 2,
      conversion_value: 80,
    });
  });
});
