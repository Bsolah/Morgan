import { describe, expect, it } from "vitest";
import { monthsBetween, oldestTransactionDate } from "./transactions.js";
import type { PlaidSyncTransaction } from "./transactions.js";

describe("plaid transactions helpers", () => {
  it("finds the oldest transaction date", () => {
    const transactions: PlaidSyncTransaction[] = [
      {
        transaction_id: "1",
        account_id: "a",
        amount: -10,
        iso_currency_code: "USD",
        unofficial_currency_code: null,
        date: "2024-03-01",
        authorized_date: null,
        name: "A",
        merchant_name: null,
        pending: false,
      },
      {
        transaction_id: "2",
        account_id: "a",
        amount: -20,
        iso_currency_code: "USD",
        unofficial_currency_code: null,
        date: "2023-01-15",
        authorized_date: null,
        name: "B",
        merchant_name: null,
        pending: false,
      },
    ];

    expect(oldestTransactionDate(transactions)).toBe("2023-01-15");
  });

  it("calculates months between dates", () => {
    expect(monthsBetween("2023-01-15", "2025-01-15")).toBe(24);
  });
});
