import { describe, expect, it } from "vitest";
import { defaultMorganCategoryForAccount } from "./account-mapping.js";
import { monthToDateRange, sumPnlByCategory } from "../accounting/pnl.js";
import { computeCogsDiscrepancy, computeQboCogsRate } from "./cogs.js";

describe("quickbooks account mapping", () => {
  it("maps COGS account types to cogs category", () => {
    expect(
      defaultMorganCategoryForAccount({
        Id: "1",
        Name: "Materials",
        AccountType: "Cost of Goods Sold",
      }),
    ).toBe("cogs");
  });

  it("maps marketing account names to marketing category", () => {
    expect(
      defaultMorganCategoryForAccount({
        Id: "2",
        Name: "Facebook Ads",
        AccountType: "Expense",
      }),
    ).toBe("marketing");
  });
});

describe("quickbooks cogs helpers", () => {
  it("computes QBO COGS rate from totals", () => {
    expect(computeQboCogsRate(250, 1000)).toBe(0.25);
    expect(computeQboCogsRate(0, 0)).toBeNull();
  });

  it("flags discrepancy above threshold", () => {
    const result = computeCogsDiscrepancy(100, 120, 5);
    expect(result.exceeds_threshold).toBe(true);
    expect(result.pct_diff).toBeGreaterThan(5);
  });

  it("sums P&L lines by mapped category", () => {
    const totals = sumPnlByCategory(
      [
        { account_id: "1", account_name: "COGS", amount: 100, section: "Expenses" },
        { account_id: "2", account_name: "Ads", amount: 50, section: "Expenses" },
      ],
      new Map([
        ["1", "cogs"],
        ["2", "marketing"],
      ]),
      new Map(),
    );

    expect(totals.cogs).toBe(100);
    expect(totals.marketing).toBe(50);
  });
});

describe("quickbooks reports helpers", () => {
  it("returns month-to-date range", () => {
    expect(monthToDateRange(new Date("2026-06-17T12:00:00.000Z"))).toEqual({
      startDate: "2026-06-01",
      endDate: "2026-06-17",
    });
  });
});
