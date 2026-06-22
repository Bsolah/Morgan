import { describe, expect, it } from "vitest";
import {
  aggregateDiscountWindowMetrics,
  DISCOUNT_BLEED_THRESHOLDS,
  evaluateDiscountBleedLeak,
  isConversionRateFlat,
  parseOrderDiscountSnapshot,
  projectDiscountBleedAmountAtRiskUsd,
  qualifiesForDiscountBleedLeak,
  type OrderDiscountSnapshot,
} from "./discount-bleed-leak.js";

function buildOrder(options: {
  day: string;
  gross: number;
  discount: number;
  code?: string;
  orderId?: string;
}): OrderDiscountSnapshot {
  return {
    day: options.day,
    order_id: options.orderId ?? `${options.day}-${options.gross}`,
    gross_revenue_usd: options.gross,
    discount_usd: options.discount,
    discount_codes: options.code ? [options.code] : [],
  };
}

function buildBleedFixture(): OrderDiscountSnapshot[] {
  const longWindowOrders: OrderDiscountSnapshot[] = [];

  for (let day = 1; day <= 30; day += 1) {
    const dayLabel = `2026-06-${String(day).padStart(2, "0")}`;
    const discountRate = day >= 24 ? 0.2 : 0.1;
    const gross = 200;
    longWindowOrders.push(
      buildOrder({
        day: dayLabel,
        gross,
        discount: gross * discountRate,
        code: day >= 24 ? "SUMMER20" : "WELCOME10",
        orderId: `order-${day}`,
      }),
    );
  }

  return longWindowOrders;
}

describe("discount bleed leak detection", () => {
  it("parses Shopify order discount snapshots", () => {
    const snapshot = parseOrderDiscountSnapshot({
      id: 1001,
      created_at: "2026-06-10T12:00:00Z",
      subtotal_price: "90.00",
      total_discounts: "10.00",
      discount_codes: [{ code: "SAVE10" }],
      line_items: [{ id: 1, quantity: 1, price: "100.00" }],
    });

    expect(snapshot).toMatchObject({
      day: "2026-06-10",
      order_id: "1001",
      gross_revenue_usd: 100,
      discount_usd: 10,
      discount_codes: ["SAVE10"],
    });
  });

  it("projects 30d excess discount exposure from the 7d bleed rate", () => {
    const gross7d = 1400;
    const rate7d = 0.2;
    const rate30d = 0.1;
    const excess7d = gross7d * (rate7d - rate30d);
    const expected = excess7d * (30 / 7);

    expect(projectDiscountBleedAmountAtRiskUsd(gross7d, rate7d, rate30d)).toBeCloseTo(expected, 4);
  });

  it("fires when discount_rate_7d exceeds discount_rate_30d by 25% and conversion is flat", () => {
    const snapshots = buildBleedFixture();
    const shortWindow = aggregateDiscountWindowMetrics(snapshots, 7, "2026-06-30");
    const longWindow = aggregateDiscountWindowMetrics(snapshots, 30, "2026-06-30");

    expect(shortWindow.discount_rate).toBeGreaterThan(longWindow.discount_rate * 1.25);
    expect(isConversionRateFlat(shortWindow.conversion_rate, longWindow.conversion_rate)).toBe(true);
    expect(
      qualifiesForDiscountBleedLeak(
        shortWindow.discount_rate,
        longWindow.discount_rate,
        shortWindow.conversion_rate,
        longWindow.conversion_rate,
      ),
    ).toBe(true);

    const evaluation = evaluateDiscountBleedLeak(snapshots, "2026-06-30");
    expect(evaluation.qualifies).toBe(true);
    expect(evaluation.amount_at_risk_usd).toBeGreaterThan(0);
    expect(evaluation.evidence).toMatchObject({
      discounts_usd: 280,
      affected_orders_count: 7,
      top_discount_codes: ["SUMMER20"],
    });
    expect(evaluation.evidence?.discount_rate_pct).toBeCloseTo(20, 1);
    expect(evaluation.evidence?.prior_discount_rate_pct).toBeCloseTo(12.33, 1);
  });

  it("does not fire when conversion rate lifts with the discounting", () => {
    const snapshots = buildBleedFixture();
    for (let day = 24; day <= 30; day += 1) {
      const dayLabel = `2026-06-${String(day).padStart(2, "0")}`;
      snapshots.push(
        buildOrder({
          day: dayLabel,
          gross: 200,
          discount: 20,
          code: "SUMMER20",
          orderId: `extra-${day}`,
        }),
      );
    }

    const evaluation = evaluateDiscountBleedLeak(snapshots, "2026-06-30");
    expect(evaluation.qualifies).toBe(false);
  });

  it("does not fire when discount rate rise is below the 25% threshold", () => {
    const snapshots: OrderDiscountSnapshot[] = [];
    for (let day = 1; day <= 30; day += 1) {
      const dayLabel = `2026-06-${String(day).padStart(2, "0")}`;
      const discountRate = day >= 27 ? 0.11 : 0.1;
      snapshots.push(
        buildOrder({
          day: dayLabel,
          gross: 200,
          discount: 200 * discountRate,
          code: "WELCOME10",
          orderId: `order-${day}`,
        }),
      );
    }

    const evaluation = evaluateDiscountBleedLeak(snapshots, "2026-06-30");
    expect(evaluation.qualifies).toBe(false);
  });

  it("treats conversion as flat within the configured tolerance", () => {
    expect(isConversionRateFlat(1, 1.04, DISCOUNT_BLEED_THRESHOLDS.conversion_rate_tolerance_pct)).toBe(
      true,
    );
    expect(isConversionRateFlat(1, 1.2, DISCOUNT_BLEED_THRESHOLDS.conversion_rate_tolerance_pct)).toBe(
      false,
    );
  });
});
