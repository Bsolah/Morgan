import { describe, expect, it } from "vitest";
import {
  buildRefundSpikeAlert,
  evaluateRefundSpikeAlert,
  sampleRefundSpikeMetrics,
} from "./refund-spike-alert-engine.js";

describe("refund spike alert engine", () => {
  it("builds warning alert with refund dollars and top SKUs", () => {
    const alert = buildRefundSpikeAlert("00000000-0000-4000-8000-000000000002", sampleRefundSpikeMetrics());

    expect(alert).toMatchObject({
      severity: "warning",
      type: "refund_spike",
      title: "Refund spike detected",
    });
    expect(alert.body).toContain("$820");
    expect(alert.body).toContain("TEE-BLU-M");
    expect(alert.top_driver).toContain("TEE-BLU-M");
    expect(alert.metric_snapshot.top_skus).toEqual(
      expect.arrayContaining([expect.objectContaining({ sku: "TEE-BLU-M" })]),
    );
  });

  it("creates alert on refunds/create webhook for demo store", async () => {
    const alert = await evaluateRefundSpikeAlert(
      null,
      "00000000-0000-4000-8000-000000000002",
      {
        payload: {
          line_items: [{ id: 11, sku: "TEE-BLU-M", quantity: 1, price: "40.00" }],
          refunds: [
            {
              refund_line_items: [{ line_item_id: 11, quantity: 1, subtotal: "40.00" }],
            },
          ],
        },
        receivedAt: new Date("2026-06-16T12:00:00.000Z"),
      },
    );

    expect(alert).not.toBeNull();
    expect(alert?.type).toBe("refund_spike");
    expect(alert?.body).toContain("TEE-BLU-M");
  });
});
