import { describe, expect, it } from "vitest";
import {
  buildIntegrationsHubSummary,
  computeIntegrationDataCoverage,
  computeOverallDataCoverage,
} from "./data-coverage.js";

describe("integration data coverage", () => {
  it("returns zero when disconnected", () => {
    expect(
      computeIntegrationDataCoverage({
        provider: "meta",
        status: "disconnected",
        fields: { ad_account_selected: true },
      }),
    ).toBe(0);
  });

  it("computes meta coverage from required fields", () => {
    expect(
      computeIntegrationDataCoverage({
        provider: "meta",
        status: "connected",
        fields: {
          ad_account_selected: true,
          insights_backfill_completed: true,
          last_sync_at: "2026-06-17T10:00:00.000Z",
        },
      }),
    ).toBe(100);
  });

  it("computes partial shopify coverage", () => {
    expect(
      computeIntegrationDataCoverage({
        provider: "shopify",
        status: "syncing",
        fields: {
          shop_domain: "demo.myshopify.com",
          orders_synced: true,
          products_synced: false,
          last_sync_at: null,
        },
      }),
    ).toBe(50);
  });

  it("averages overall coverage across active cards", () => {
    expect(
      computeOverallDataCoverage([
        { data_coverage_pct: 100 },
        { data_coverage_pct: 50 },
        { data_coverage_pct: 0, coming_soon: true },
      ]),
    ).toBe(75);
  });

  it("builds summary for disconnected integrations", () => {
    expect(
      buildIntegrationsHubSummary([
        { provider: "shopify", status: "connected" },
        { provider: "meta", status: "disconnected" },
        { provider: "plaid", status: "disconnected" },
      ]),
    ).toBe("Connect Meta Ads and Bank (Plaid) to unlock fuller briefings.");
  });
});
