import { describe, expect, it } from "vitest";
import { sumPnlByCategory } from "./pnl.js";
import type { AccountingMorganCategory } from "./categories.js";

describe("accounting provider helpers", () => {
  it("sums P&L lines by mapped category", () => {
    const byAccountId = new Map<string, AccountingMorganCategory>([["1", "cogs"]]);
    const byAccountName = new Map<string, AccountingMorganCategory>();

    const totals = sumPnlByCategory(
      [
        {
          account_id: "1",
          account_name: "Materials",
          amount: 120,
          section: "Expenses",
        },
      ],
      byAccountId,
      byAccountName,
    );

    expect(totals.cogs).toBe(120);
  });
});
