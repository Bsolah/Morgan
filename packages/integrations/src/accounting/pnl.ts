import type { AccountingCategoryTotals, PnlLine } from "./types.js";
import type { AccountingMorganCategory } from "./categories.js";

export function emptyAccountingCategoryTotals(): AccountingCategoryTotals {
  return {
    cogs: 0,
    shipping: 0,
    marketing: 0,
    opex: 0,
    other: 0,
    unmapped: 0,
  };
}

export function sumPnlByCategory(
  lines: PnlLine[],
  categoryByAccountId: Map<string, AccountingMorganCategory>,
  categoryByAccountName: Map<string, AccountingMorganCategory>,
): AccountingCategoryTotals {
  const totals = emptyAccountingCategoryTotals();

  for (const line of lines) {
    const category =
      (line.account_id ? categoryByAccountId.get(line.account_id) : undefined) ??
      categoryByAccountName.get(line.account_name.toLowerCase()) ??
      "unmapped";
    totals[category] += Math.abs(line.amount);
  }

  return totals;
}

export function monthToDateRange(referenceDay = new Date()): { startDate: string; endDate: string } {
  const endDate = referenceDay.toISOString().slice(0, 10);
  const startDate = `${endDate.slice(0, 7)}-01`;
  return { startDate, endDate };
}

export function periodMonthFromDay(day: string): string {
  return day.slice(0, 7);
}
