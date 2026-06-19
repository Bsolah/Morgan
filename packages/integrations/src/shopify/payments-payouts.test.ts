import { describe, expect, it } from "vitest";
import {
  averagePayoutIntervalDays,
  daysSinceLastPayout,
  groupExpectedInflowsByDay,
  payoutIntervalDays,
  shouldCreatePayoutDelayAlert,
  type ShopifyPayoutNode,
} from "./payments-payouts.js";

const payouts: ShopifyPayoutNode[] = [
  {
    id: "gid://shopify/ShopifyPaymentsPayout/1",
    issuedAt: "2026-06-01T00:00:00.000Z",
    status: "PAID",
    net: { amount: "1000.00", currencyCode: "USD" },
  },
  {
    id: "gid://shopify/ShopifyPaymentsPayout/2",
    issuedAt: "2026-06-04T00:00:00.000Z",
    status: "PAID",
    net: { amount: "1200.00", currencyCode: "USD" },
  },
  {
    id: "gid://shopify/ShopifyPaymentsPayout/3",
    issuedAt: "2026-06-17T00:00:00.000Z",
    status: "SCHEDULED",
    net: { amount: "800.00", currencyCode: "USD" },
  },
];

describe("payments payouts helpers", () => {
  it("computes payout interval averages", () => {
    const intervals = payoutIntervalDays(payouts);
    expect(intervals).toEqual([3]);
    expect(averagePayoutIntervalDays(intervals)).toBe(3);
  });

  it("creates payout delay alert when wait exceeds average by threshold", () => {
    const intervals = payoutIntervalDays(payouts);
    const average = averagePayoutIntervalDays(intervals);
    const wait = daysSinceLastPayout(payouts, new Date("2026-06-11T00:00:00.000Z"));

    expect(shouldCreatePayoutDelayAlert({
      daysSinceLastPayout: wait,
      averageIntervalDays: average,
      thresholdDays: 3,
    })).toBe(true);
  });

  it("groups scheduled payouts into mart_cash_daily inflows by day", () => {
    const grouped = groupExpectedInflowsByDay(payouts);
    expect(grouped.get("2026-06-17")).toMatchObject({
      amount: 800,
      count: 1,
      currency: "USD",
    });
  });
});
