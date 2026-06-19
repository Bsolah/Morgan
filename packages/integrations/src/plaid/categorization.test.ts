import { describe, expect, it } from "vitest";
import { categorizePlaidTransaction } from "./categorization.js";
import type { PlaidSyncTransaction } from "./transactions.js";

function txn(overrides: Partial<PlaidSyncTransaction> = {}): PlaidSyncTransaction {
  return {
    transaction_id: "txn-1",
    account_id: "acct-1",
    amount: -42.5,
    iso_currency_code: "USD",
    unofficial_currency_code: null,
    date: "2025-01-15",
    authorized_date: null,
    name: "Unknown charge",
    merchant_name: null,
    pending: false,
    ...overrides,
  };
}

describe("categorizePlaidTransaction", () => {
  it("classifies Shopify payouts", () => {
    const result = categorizePlaidTransaction(
      txn({ name: "SHOPIFY PAYOUT", amount: 1200, merchant_name: "Shopify" }),
    );
    expect(result.category).toBe("shopify_payout");
  });

  it("classifies Meta ad spend", () => {
    const result = categorizePlaidTransaction(txn({ name: "FACEBOOK ADS", merchant_name: "Meta" }));
    expect(result.category).toBe("ad_spend");
  });

  it("classifies payroll providers", () => {
    const result = categorizePlaidTransaction(txn({ name: "GUSTO PAYROLL" }));
    expect(result.category).toBe("payroll");
  });

  it("classifies SaaS subscriptions", () => {
    const result = categorizePlaidTransaction(txn({ name: "KLAVIYO INC" }));
    expect(result.category).toBe("saas");
  });

  it("classifies COGS payments", () => {
    const result = categorizePlaidTransaction(txn({ name: "WHOLESALE SUPPLIER LLC" }));
    expect(result.category).toBe("cogs_payment");
  });

  it("queues ambiguous outflows as uncategorized", () => {
    const result = categorizePlaidTransaction(txn({ name: "POS DEBIT 4821", amount: -18.2 }));
    expect(result.category).toBe("uncategorized");
  });

  it("maps inflows without a rule to other", () => {
    const result = categorizePlaidTransaction(txn({ name: "WIRE TRANSFER", amount: 500 }));
    expect(result.category).toBe("other");
  });
});
