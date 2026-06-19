import { and, eq, gte, lte, plaidTransactions, stores, type Database } from "@morgan/db";
import {
  buildDailyCashFlowBreakdown,
  buildTrailingDayWindow,
  CASH_RUNWAY_TRAILING_DAYS,
} from "@morgan/integrations";
import { getProfitOverview } from "./profit-overview-service.js";
import { getPayoutStatus } from "./payout-sync-service.js";
import { merchantLocalDay } from "./cash-runway-service.js";

export type CashFlowBreakdownPoint = {
  day: string;
  inflows_usd: number;
  outflows_usd: number;
};

export type ExpectedPayoutView = {
  day: string;
  amount: string;
  currency: string;
  payout_count: number;
};

export type ProfitOnlyCashView = {
  available: boolean;
  contribution_margin_30d: number | null;
  net_revenue_30d: number | null;
  disclaimer: string;
};

export type CashPositionExtras = {
  window_days: number;
  flow_breakdown: CashFlowBreakdownPoint[];
  expected_payouts: ExpectedPayoutView[];
  profit_only: ProfitOnlyCashView | null;
};

const PROFIT_ONLY_DISCLAIMER =
  "Bank not connected. Showing 30-day profit metrics only. Connect your bank for cash balance, runway, and cash flow.";

async function loadCashFlowTransactions(
  db: Database,
  storeId: string,
  startDay: string,
  endDay: string,
) {
  const rows = await db
    .select({
      date: plaidTransactions.transactionDate,
      amount: plaidTransactions.amount,
    })
    .from(plaidTransactions)
    .where(
      and(
        eq(plaidTransactions.storeId, storeId),
        eq(plaidTransactions.removed, false),
        eq(plaidTransactions.pending, false),
        gte(plaidTransactions.transactionDate, startDay),
        lte(plaidTransactions.transactionDate, endDay),
      ),
    );

  return rows.map((row) => ({
    date: row.date,
    amount: Number(row.amount),
  }));
}

async function loadProfitOnlySummary(db: Database, storeId: string): Promise<ProfitOnlyCashView> {
  try {
    const overview = await getProfitOverview(db, storeId, CASH_RUNWAY_TRAILING_DAYS);
    const contributionMargin30d = overview.trend.reduce(
      (sum, point) => sum + point.contribution_margin,
      0,
    );
    const netRevenue30d = overview.trend.reduce((sum, point) => sum + point.net_revenue, 0);

    return {
      available: overview.trend.length > 0,
      contribution_margin_30d: Math.round(contributionMargin30d * 100) / 100,
      net_revenue_30d: Math.round(netRevenue30d * 100) / 100,
      disclaimer: PROFIT_ONLY_DISCLAIMER,
    };
  } catch {
    return {
      available: false,
      contribution_margin_30d: null,
      net_revenue_30d: null,
      disclaimer: PROFIT_ONLY_DISCLAIMER,
    };
  }
}

export async function getCashPositionExtras(
  db: Database,
  storeId: string,
  bankConnected: boolean,
): Promise<CashPositionExtras> {
  const [store] = await db
    .select({ timezone: stores.timezone })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);

  const asOfDay = merchantLocalDay(store?.timezone ?? "UTC");
  const { startDay, endDay } = buildTrailingDayWindow(asOfDay, CASH_RUNWAY_TRAILING_DAYS);

  const [payoutStatus, transactions, profitOnly] = await Promise.all([
    getPayoutStatus(db, storeId),
    bankConnected ? loadCashFlowTransactions(db, storeId, startDay, endDay) : Promise.resolve([]),
    bankConnected ? Promise.resolve(null) : loadProfitOnlySummary(db, storeId),
  ]);

  return {
    window_days: CASH_RUNWAY_TRAILING_DAYS,
    flow_breakdown: bankConnected
      ? buildDailyCashFlowBreakdown(transactions, asOfDay, CASH_RUNWAY_TRAILING_DAYS)
      : [],
    expected_payouts: payoutStatus.expected_inflows.map((row) => ({
      day: row.day,
      amount: row.amount,
      currency: row.currency,
      payout_count: row.payout_count,
    })),
    profit_only: profitOnly,
  };
}
