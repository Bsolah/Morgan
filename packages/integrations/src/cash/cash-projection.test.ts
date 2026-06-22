import { describe, expect, it } from "vitest";
import {
  buildCashProjection,
  buildForwardProjectionDays,
  CASH_PROJECTION_HORIZON_DAYS,
  deriveOutflowBaselines,
  detectZeroCrossingDay,
  projectRecurringPayoutInflows,
} from "./cash-projection.js";

describe("cash projection", () => {
  it("derives recurring, variable, and ad spend baselines from trailing window", () => {
    const baselines = deriveOutflowBaselines(
      [
        { date: "2026-06-01", amount: -3000, category: "payroll" },
        { date: "2026-06-02", amount: -100, category: "saas" },
        { date: "2026-06-03", amount: -200, category: "ad_spend" },
        { date: "2026-06-04", amount: -50, category: "other" },
      ],
      "2026-06-30",
      30,
    );

    expect(baselines.avg_daily_recurring_outflow_usd).toBe(103.33);
    expect(baselines.avg_daily_variable_outflow_usd).toBe(1.67);
    expect(baselines.avg_daily_ad_spend_usd).toBe(6.67);
  });

  it("projects balance forward with payouts, recurring outflows, and assumptions", () => {
    const inflows = new Map<string, number>([
      ["2026-07-01", 5000],
      ["2026-07-15", 5000],
    ]);

    const projection = buildCashProjection({
      starting_balance_usd: 10000,
      as_of_day: "2026-06-30",
      horizon_days: 30,
      transactions: [
        { date: "2026-06-01", amount: -3000, category: "payroll" },
        { date: "2026-06-02", amount: -200, category: "ad_spend" },
        { date: "2026-06-03", amount: -100, category: "other" },
      ],
      inflows_by_day: inflows,
      assumptions: {
        expected_daily_ad_spend_usd: 150,
        planned_inventory_purchase_usd: 2000,
        planned_inventory_purchase_day: "2026-07-10",
      },
      trailing_days: 30,
    });

    expect(projection.points).toHaveLength(31);
    expect(projection.points[0]?.balance_usd).toBe(10000);
    const july10 = projection.points.find((point) => point.day === "2026-07-10");
    expect(july10?.inventory_outflows_usd).toBe(2000);
    expect(july10?.ad_spend_outflows_usd).toBe(150);
    expect(projection.zero_crossing_day).toBeNull();
  });

  it("flags zero crossing day when balance drops below zero", () => {
    const projection = buildCashProjection({
      starting_balance_usd: 500,
      as_of_day: "2026-06-30",
      horizon_days: 10,
      transactions: [{ date: "2026-06-01", amount: -3000, category: "payroll" }],
      inflows_by_day: new Map(),
      assumptions: {
        expected_daily_ad_spend_usd: 0,
        planned_inventory_purchase_usd: 0,
        planned_inventory_purchase_day: null,
      },
      trailing_days: 30,
    });

    expect(projection.zero_crossing_day).toBe("2026-07-05");
    expect(detectZeroCrossingDay(projection.points, 500)).toBe(projection.zero_crossing_day);
  });

  it("extends scheduled payouts with recurring cadence from paid history", () => {
    const scheduled = new Map<string, number>([["2026-07-05", 4000]]);
    const extended = projectRecurringPayoutInflows({
      paidPayouts: [
        {
          id: "1",
          issuedAt: "2026-06-01T00:00:00.000Z",
          status: "PAID",
          net: { amount: "3000", currencyCode: "USD" },
        },
        {
          id: "2",
          issuedAt: "2026-06-04T00:00:00.000Z",
          status: "PAID",
          net: { amount: "3200", currencyCode: "USD" },
        },
        {
          id: "3",
          issuedAt: "2026-06-07T00:00:00.000Z",
          status: "PAID",
          net: { amount: "3100", currencyCode: "USD" },
        },
      ],
      scheduledByDay: scheduled,
      asOfDay: "2026-06-30",
      horizonDays: 30,
    });

    expect(extended.get("2026-07-05")).toBe(4000);
    expect((extended.get("2026-07-10") ?? 0) > 0).toBe(true);
  });

  it("builds 61 points for a 60-day horizon including as-of day", () => {
    const days = buildForwardProjectionDays("2026-06-01", CASH_PROJECTION_HORIZON_DAYS);
    expect(days).toHaveLength(CASH_PROJECTION_HORIZON_DAYS + 1);
    expect(days[0]).toBe("2026-06-01");
    expect(days[days.length - 1]).toBe("2026-07-31");
  });
});
