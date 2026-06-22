import { describe, expect, it } from "vitest";
import {
  evaluateReturnDrainLeak,
  evaluateReturnDrainLeaks,
  parseOrderSkuReturnActivity,
  qualifiesForReturnDrainLeak,
  type SkuReturnActivity,
} from "./return-drain-leak.js";

const CATEGORY_BY_SKU = new Map<string, string>([
  ["TEE-BLUE-M", "tee-product"],
  ["TEE-BLUE-L", "tee-product"],
  ["TEE-RED-M", "tee-product"],
  ["TEE-RED-L", "tee-product"],
  ["TEE-GREEN-M", "tee-product"],
  ["TEE-BLACK-M", "tee-product"],
]);

function buildSale(day: string, sku: string, quantity: number, orderId: string): SkuReturnActivity {
  return {
    day,
    order_id: orderId,
    sku,
    category: CATEGORY_BY_SKU.get(sku) ?? "tee-product",
    units_sold: quantity,
    units_returned: 0,
    return_usd: 0,
    return_reasons: [],
  };
}

function buildReturn(
  day: string,
  sku: string,
  quantity: number,
  returnUsd: number,
  reason: string,
  orderId: string,
): SkuReturnActivity {
  return {
    day,
    order_id: orderId,
    sku,
    category: CATEGORY_BY_SKU.get(sku) ?? "tee-product",
    units_sold: 0,
    units_returned: quantity,
    return_usd: returnUsd,
    return_reasons: [reason],
  };
}

function buildHealthyCategoryFixture(): SkuReturnActivity[] {
  const activities: SkuReturnActivity[] = [];
  const healthySkus = ["TEE-BLUE-M", "TEE-BLUE-L", "TEE-RED-M", "TEE-RED-L", "TEE-GREEN-M"];

  for (let day = 1; day <= 30; day += 1) {
    const dayLabel = `2026-06-${String(day).padStart(2, "0")}`;
    for (const sku of healthySkus) {
      activities.push(buildSale(dayLabel, sku, 4, `${sku}-sale-${day}`));
      if (day % 10 === 0) {
        activities.push(buildReturn(dayLabel, sku, 1, 25, "Fit issue", `${sku}-return-${day}`));
      }
    }
  }

  return activities;
}

describe("return drain leak detection", () => {
  it("parses Shopify order line returns with reasons", () => {
    const activities = parseOrderSkuReturnActivity(
      {
        id: 2001,
        created_at: "2026-06-15T12:00:00Z",
        line_items: [
          { id: 11, sku: "TEE-BLUE-M", quantity: 2, price: "40.00" },
          { id: 12, sku: "TEE-RED-L", quantity: 1, price: "45.00" },
        ],
        refunds: [
          {
            note: "Too small",
            refund_line_items: [{ line_item_id: 11, quantity: 1, subtotal: "40.00" }],
          },
        ],
      },
      "2001",
      CATEGORY_BY_SKU,
    );

    expect(activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sku: "TEE-BLUE-M",
          units_sold: 2,
          units_returned: 0,
        }),
        expect.objectContaining({
          sku: "TEE-BLUE-M",
          units_returned: 1,
          return_usd: 40,
          return_reasons: ["Too small"],
        }),
      ]),
    );
  });

  it("fires when SKU return rate exceeds category mean + 2σ with at least 10 returns", () => {
    const activities = buildHealthyCategoryFixture();

    for (let day = 1; day <= 30; day += 1) {
      const dayLabel = `2026-06-${String(day).padStart(2, "0")}`;
      activities.push(buildSale(dayLabel, "TEE-BLACK-M", 5, `black-sale-${day}`));
      activities.push(
        buildReturn(dayLabel, "TEE-BLACK-M", 1, 30, "Defective stitching", `black-return-${day}`),
      );
    }

    const evaluation = evaluateReturnDrainLeak(activities, "TEE-BLACK-M", "2026-06-30");
    expect(evaluation.qualifies).toBe(true);
    expect(evaluation.amount_at_risk_usd).toBe(900);
    expect(evaluation.evidence).toMatchObject({
      sku: "TEE-BLACK-M",
      category: "tee-product",
      returns_count: 30,
      returns_usd: 900,
      top_return_reasons: ["Defective stitching"],
    });
    expect(evaluation.evidence?.return_rate_pct ?? 0).toBeGreaterThan(
      (evaluation.evidence?.category_mean_return_rate_pct ?? 0) +
        2 * (evaluation.evidence?.category_return_rate_stddev_pct ?? 0),
    );
  });

  it("does not fire with fewer than 10 returns", () => {
    const activities = buildHealthyCategoryFixture();
    for (let day = 1; day <= 9; day += 1) {
      const dayLabel = `2026-06-${String(day).padStart(2, "0")}`;
      activities.push(buildReturn(dayLabel, "TEE-BLACK-M", 1, 30, "Defective stitching", `few-${day}`));
    }

    const evaluation = evaluateReturnDrainLeak(activities, "TEE-BLACK-M", "2026-06-30");
    expect(evaluation.qualifies).toBe(false);
  });

  it("does not fire when SKU return rate is within the category band", () => {
    const activities = buildHealthyCategoryFixture();
    const evaluations = evaluateReturnDrainLeaks(activities, "2026-06-30");

    expect(evaluations.every((evaluation) => evaluation.qualifies === false)).toBe(true);
  });

  it("requires a category benchmark with at least two SKUs", () => {
    const qualifies = qualifiesForReturnDrainLeak(
      {
        sku: "ONLY-SKU",
        category: "solo",
        units_sold: 100,
        units_returned: 20,
        return_usd: 500,
        return_rate: 0.2,
        return_reason_counts: new Map(),
      },
      {
        category: "solo",
        mean_return_rate: 0.05,
        stddev_return_rate: 0.02,
        sku_count: 1,
      },
    );

    expect(qualifies).toBe(false);
  });
});
