import { describe, expect, it, beforeEach } from "vitest";
import { resetAlertsStore, listStoreAlerts } from "./alerts-store.js";
import { buildProfitLeakAlert, createAlertsForNewProfitLeaks } from "./profit-leak-alert-service.js";

const sampleLeak = {
  id: "leak-2",
  storeId: "store-1",
  leakType: "dead_stock",
  externalKey: "SKU-1",
  status: "active" as const,
  severity: "warning" as const,
  amountAtRiskUsd: "500.0000",
  evidence: [{ sku: "SKU-1" }],
  dedupeKey: "dead_stock:SKU-1",
  resolvedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("profit-leak-alert-service", () => {
  beforeEach(() => {
    resetAlertsStore();
  });

  it("builds an inbox alert from a profit leak row", () => {
    const alert = buildProfitLeakAlert("store-1", {
      id: "leak-1",
      storeId: "store-1",
      leakType: "discount_bleed",
      externalKey: "store",
      status: "active",
      severity: "warning",
      amountAtRiskUsd: "1200.0000",
      evidence: [{ discount_rate_7d_pct: 18 }],
      dedupeKey: "discount_bleed:store",
      resolvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(alert.type).toBe("profit_leak");
    expect(alert.links.recommendation).toBe("/recommendations/leak-1");
    expect(alert.magnitude).toContain("$1,200");
  });

  it("creates alerts only for newly active dedupe keys", async () => {
    const db = {
      select: () => ({
        from: () => ({
          where: async () => [sampleLeak],
        }),
      }),
    };

    const created = await createAlertsForNewProfitLeaks(
      db as never,
      "store-1",
      new Set(["dead_stock:OTHER"]),
    );

    expect(created).toBe(1);
    expect(listStoreAlerts("store-1")).toHaveLength(1);
    expect(listStoreAlerts("store-1")[0]?.type).toBe("profit_leak");
  });
});
