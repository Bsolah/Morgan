import { describe, expect, it } from "vitest";
import { computeIntegrationDataCoverage } from "@morgan/integrations";

describe("integrations hub card coverage mapping", () => {
  it("treats partial shopify backfill as orders synced", () => {
    expect(
      computeIntegrationDataCoverage({
        provider: "shopify",
        status: "syncing",
        fields: {
          shop_domain: "demo.myshopify.com",
          orders_synced: true,
          products_synced: false,
          last_sync_at: "2026-06-17T10:00:00.000Z",
        },
      }),
    ).toBe(100);
  });
});
