import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  amountWithinTolerance,
  businessDaysBetween,
  findAutoPayoutDepositMatches,
  scorePayoutDepositMatch,
  type DepositCandidate,
  type PayoutCandidate,
} from "./payout-matching.js";

function payout(overrides: Partial<PayoutCandidate> = {}): PayoutCandidate {
  return {
    id: "payout-1",
    issuedAt: "2025-01-06T12:00:00.000Z",
    netAmount: 1000,
    currency: "USD",
    status: "paid",
    ...overrides,
  };
}

function deposit(overrides: Partial<DepositCandidate> = {}): DepositCandidate {
  return {
    id: "deposit-1",
    transactionDate: "2025-01-07",
    amount: 1000,
    currency: "USD",
    name: "SHOPIFY PAYOUT",
    merchantName: "Shopify",
    category: "shopify_payout",
    pending: false,
    ...overrides,
  };
}

describe("payout matching", () => {
  it("accepts deposits within 1% tolerance", () => {
    expect(amountWithinTolerance(1000, 1005)).toBe(true);
    expect(amountWithinTolerance(1000, 1011)).toBe(false);
  });

  it("counts business days between payout and deposit", () => {
    expect(businessDaysBetween("2025-01-06", "2025-01-07")).toBe(1);
    expect(businessDaysBetween("2025-01-06", "2025-01-08")).toBe(2);
    expect(addBusinessDays("2025-01-06", 3)).toBe("2025-01-09");
  });

  it("scores high-confidence exact matches", () => {
    const score = scorePayoutDepositMatch(payout(), deposit());
    expect(score).not.toBeNull();
    expect(score!).toBeGreaterThanOrEqual(90);
  });

  it("rejects deposits outside the business-day window", () => {
    const score = scorePayoutDepositMatch(
      payout({ issuedAt: "2025-01-06T12:00:00.000Z" }),
      deposit({ transactionDate: "2025-01-15" }),
    );
    expect(score).toBeNull();
  });

  it("auto-matches only pairs above the confidence threshold", () => {
    const matches = findAutoPayoutDepositMatches(
      [payout()],
      [deposit(), deposit({ id: "deposit-2", amount: 500 })],
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      payoutId: "payout-1",
      depositId: "deposit-1",
      confidenceScore: expect.any(Number),
    });
    expect(matches[0]!.confidenceScore).toBeGreaterThanOrEqual(90);
  });
});
