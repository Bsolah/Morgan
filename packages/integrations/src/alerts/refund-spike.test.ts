import { describe, expect, it } from "vitest";
import {
  buildRefundSpikeBody,
  buildRefundSpikeMetrics,
  computeRolling24hRefundUsd,
  extractTopAffectedSkus,
  qualifiesForRefundSpikeAlert,
} from "./refund-spike.js";

describe("refund spike alert", () => {
  it("computes rolling 24h refund total from daily buckets", () => {
    const rolling = computeRolling24hRefundUsd(
      [
        { day: "2026-06-15", refunds_usd: 200 },
        { day: "2026-06-16", refunds_usd: 400 },
      ],
      "2026-06-16",
    );
    expect(rolling).toBe(500);
  });

  it("qualifies when rolling 24h exceeds mean + 2σ", () => {
    expect(
      qualifiesForRefundSpikeAlert({
        rolling_24h_usd: 900,
        daily_refunds_7d: [100, 120, 110, 90, 100, 95, 105],
      }),
    ).toBe(true);

    expect(
      qualifiesForRefundSpikeAlert({
        rolling_24h_usd: 80,
        daily_refunds_7d: [100, 120, 110, 90, 100, 95, 105],
      }),
    ).toBe(false);
  });

  it("extracts top affected SKUs from refund webhook payload", () => {
    const skus = extractTopAffectedSkus({
      line_items: [{ id: 11, sku: "TEE-BLU-M", quantity: 2, price: "40.00" }],
      refunds: [
        {
          refund_line_items: [{ line_item_id: 11, quantity: 1, subtotal: "40.00" }],
        },
      ],
    });

    expect(skus).toEqual([{ sku: "TEE-BLU-M", refund_usd: 40, units_returned: 1 }]);
  });

  it("builds alert body with refund dollars and top SKUs", () => {
    const metrics = buildRefundSpikeMetrics({
      referenceDay: "2026-06-16",
      dailyTotals: [
        { day: "2026-06-09", refunds_usd: 100 },
        { day: "2026-06-10", refunds_usd: 110 },
        { day: "2026-06-11", refunds_usd: 95 },
        { day: "2026-06-12", refunds_usd: 105 },
        { day: "2026-06-13", refunds_usd: 100 },
        { day: "2026-06-14", refunds_usd: 90 },
        { day: "2026-06-15", refunds_usd: 120 },
        { day: "2026-06-16", refunds_usd: 300 },
      ],
      topSkus: [{ sku: "TEE-BLU-M", refund_usd: 120, units_returned: 3 }],
      webhookRefundUsd: 200,
    });

    const body = buildRefundSpikeBody(metrics);
    expect(body).toContain("Top SKUs");
    expect(body).toContain("TEE-BLU-M");
    expect(body).toContain("$");
  });
});
