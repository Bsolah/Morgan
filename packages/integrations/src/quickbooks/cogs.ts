import type { QuickBooksMorganCategory } from "./categories.js";
import type { QuickBooksPnlLine } from "./reports.js";

export type QuickBooksCategoryTotals = Record<QuickBooksMorganCategory, number>;

export function emptyCategoryTotals(): QuickBooksCategoryTotals {
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
  lines: QuickBooksPnlLine[],
  categoryByAccountId: Map<string, QuickBooksMorganCategory>,
  categoryByAccountName: Map<string, QuickBooksMorganCategory>,
): QuickBooksCategoryTotals {
  const totals = emptyCategoryTotals();

  for (const line of lines) {
    const category =
      (line.account_id ? categoryByAccountId.get(line.account_id) : undefined) ??
      categoryByAccountName.get(line.account_name.toLowerCase()) ??
      "unmapped";
    totals[category] += Math.abs(line.amount);
  }

  return totals;
}

export function computeQboCogsRate(cogsTotal: number, revenueBase: number): number | null {
  if (revenueBase <= 0 || cogsTotal < 0) return null;
  const rate = cogsTotal / revenueBase;
  if (!Number.isFinite(rate)) return null;
  return Math.min(1, Math.max(0, rate));
}

export type CogsDiscrepancyResult = {
  shopify_cogs: number;
  qbo_cogs: number;
  pct_diff: number;
  exceeds_threshold: boolean;
};

export function computeCogsDiscrepancy(
  shopifyCogs: number,
  qboCogs: number,
  thresholdPct = 5,
): CogsDiscrepancyResult {
  const shopify = Math.max(0, shopifyCogs);
  const qbo = Math.max(0, qboCogs);

  if (shopify === 0 && qbo === 0) {
    return { shopify_cogs: 0, qbo_cogs: 0, pct_diff: 0, exceeds_threshold: false };
  }

  const baseline = Math.max(shopify, qbo, 1);
  const pctDiff = (Math.abs(qbo - shopify) / baseline) * 100;

  return {
    shopify_cogs: shopify,
    qbo_cogs: qbo,
    pct_diff: pctDiff,
    exceeds_threshold: pctDiff > thresholdPct,
  };
}

export function computeShopifyCogsFromOrders(
  orders: Array<{
    revenue: number;
    lineItems: Array<{ quantity: number; unitCost: number }>;
  }>,
): number {
  return orders.reduce((sum, order) => {
    const orderCogs = order.lineItems.reduce(
      (lineSum, line) => lineSum + line.quantity * Math.max(0, line.unitCost),
      0,
    );
    return sum + orderCogs;
  }, 0);
}
