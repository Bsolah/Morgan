import type { MorganTransactionCategory } from "../plaid/categorization.js";
import {
  addDaysToDayString,
  buildTrailingDayWindow,
  CASH_RUNWAY_TRAILING_DAYS,
} from "./runway.js";
import {
  averagePayoutIntervalDays,
  payoutIntervalDays,
  type ShopifyPayoutNode,
} from "../shopify/payments-payouts.js";

export const CASH_PROJECTION_HORIZON_DAYS = 60;

const RECURRING_OUTFLOW_CATEGORIES: MorganTransactionCategory[] = ["payroll", "saas"];
const VARIABLE_OUTFLOW_CATEGORIES: MorganTransactionCategory[] = [
  "other",
  "cogs_payment",
  "uncategorized",
];

export type CategorizedRunwayTransaction = {
  date: string;
  amount: number;
  category: MorganTransactionCategory | "uncategorized";
};

export type CashProjectionAssumptions = {
  expected_daily_ad_spend_usd: number;
  planned_inventory_purchase_usd: number;
  planned_inventory_purchase_day: string | null;
};

export type CashProjectionOutflowBaselines = {
  avg_daily_recurring_outflow_usd: number;
  avg_daily_variable_outflow_usd: number;
  avg_daily_ad_spend_usd: number;
};

export type CashProjectionPoint = {
  day: string;
  balance_usd: number;
  inflows_usd: number;
  outflows_usd: number;
  recurring_outflows_usd: number;
  variable_outflows_usd: number;
  ad_spend_outflows_usd: number;
  inventory_outflows_usd: number;
};

export type CashProjectionResult = {
  as_of_day: string;
  horizon_days: number;
  starting_balance_usd: number;
  zero_crossing_day: string | null;
  baselines: CashProjectionOutflowBaselines;
  assumptions: CashProjectionAssumptions;
  points: CashProjectionPoint[];
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function categoryOutflowTotal(
  transactions: CategorizedRunwayTransaction[],
  startDay: string,
  endDay: string,
  categories: MorganTransactionCategory[],
): number {
  let total = 0;
  for (const transaction of transactions) {
    if (transaction.date < startDay || transaction.date > endDay) continue;
    if (transaction.amount >= 0) continue;
    if (!categories.includes(transaction.category as MorganTransactionCategory)) continue;
    total += Math.abs(transaction.amount);
  }
  return total;
}

export function deriveOutflowBaselines(
  transactions: CategorizedRunwayTransaction[],
  asOfDay: string,
  windowDays = CASH_RUNWAY_TRAILING_DAYS,
): CashProjectionOutflowBaselines {
  const { startDay, endDay } = buildTrailingDayWindow(asOfDay, windowDays);
  const recurringTotal = categoryOutflowTotal(
    transactions,
    startDay,
    endDay,
    RECURRING_OUTFLOW_CATEGORIES,
  );
  const variableTotal = categoryOutflowTotal(
    transactions,
    startDay,
    endDay,
    VARIABLE_OUTFLOW_CATEGORIES,
  );
  const adSpendTotal = categoryOutflowTotal(transactions, startDay, endDay, ["ad_spend"]);

  return {
    avg_daily_recurring_outflow_usd: roundMoney(recurringTotal / windowDays),
    avg_daily_variable_outflow_usd: roundMoney(variableTotal / windowDays),
    avg_daily_ad_spend_usd: roundMoney(adSpendTotal / windowDays),
  };
}

export function projectRecurringPayoutInflows(input: {
  paidPayouts: ShopifyPayoutNode[];
  scheduledByDay: Map<string, number>;
  asOfDay: string;
  horizonDays: number;
}): Map<string, number> {
  const merged = new Map(input.scheduledByDay);
  const intervals = payoutIntervalDays(input.paidPayouts);
  const avgInterval = averagePayoutIntervalDays(intervals);
  if (!avgInterval || avgInterval <= 0) return merged;

  const paid = [...input.paidPayouts]
    .filter((payout) => payout.status === "PAID" && payout.issuedAt)
    .sort((left, right) => left.issuedAt.localeCompare(right.issuedAt));

  if (paid.length === 0) return merged;

  const avgAmount =
    paid.reduce((sum, payout) => sum + Number(payout.net.amount), 0) / paid.length;
  const lastPaidDay = paid[paid.length - 1]!.issuedAt.slice(0, 10);
  const endDay = addDaysToDayString(input.asOfDay, input.horizonDays);

  let nextDay = addDaysToDayString(lastPaidDay, Math.max(1, Math.round(avgInterval)));
  while (nextDay <= endDay) {
    if (nextDay > input.asOfDay) {
      merged.set(nextDay, roundMoney((merged.get(nextDay) ?? 0) + avgAmount));
    }
    nextDay = addDaysToDayString(nextDay, Math.max(1, Math.round(avgInterval)));
  }

  return merged;
}

export function buildForwardProjectionDays(asOfDay: string, horizonDays: number): string[] {
  const days: string[] = [asOfDay];
  for (let index = 1; index <= horizonDays; index += 1) {
    days.push(addDaysToDayString(asOfDay, index));
  }
  return days;
}

export function detectZeroCrossingDay(
  points: Array<{ day: string; balance_usd: number }>,
  startingBalance: number,
): string | null {
  if (startingBalance <= 0) {
    return points[0]?.day ?? null;
  }

  for (const point of points) {
    if (point.balance_usd <= 0) {
      return point.day;
    }
  }

  return null;
}

export function buildCashProjection(input: {
  starting_balance_usd: number;
  as_of_day: string;
  horizon_days?: number;
  transactions: CategorizedRunwayTransaction[];
  inflows_by_day: Map<string, number>;
  assumptions: CashProjectionAssumptions;
  trailing_days?: number;
}): CashProjectionResult {
  const horizonDays = input.horizon_days ?? CASH_PROJECTION_HORIZON_DAYS;
  const baselines = deriveOutflowBaselines(
    input.transactions,
    input.as_of_day,
    input.trailing_days,
  );

  const dailyAdSpend =
    input.assumptions.expected_daily_ad_spend_usd > 0
      ? input.assumptions.expected_daily_ad_spend_usd
      : baselines.avg_daily_ad_spend_usd;

  const days = buildForwardProjectionDays(input.as_of_day, horizonDays);
  const points: CashProjectionPoint[] = [];
  let balance = input.starting_balance_usd;

  for (const day of days) {
    const inflows = roundMoney(input.inflows_by_day.get(day) ?? 0);
    const recurring = baselines.avg_daily_recurring_outflow_usd;
    const variable = baselines.avg_daily_variable_outflow_usd;
    const adSpend = dailyAdSpend;
    const inventory =
      input.assumptions.planned_inventory_purchase_day === day
        ? input.assumptions.planned_inventory_purchase_usd
        : 0;
    const outflows = roundMoney(recurring + variable + adSpend + inventory);

    if (day === input.as_of_day) {
      points.push({
        day,
        balance_usd: roundMoney(balance),
        inflows_usd: inflows,
        outflows_usd: outflows,
        recurring_outflows_usd: recurring,
        variable_outflows_usd: variable,
        ad_spend_outflows_usd: adSpend,
        inventory_outflows_usd: inventory,
      });
      continue;
    }

    balance = roundMoney(balance + inflows - outflows);
    points.push({
      day,
      balance_usd: balance,
      inflows_usd: inflows,
      outflows_usd: outflows,
      recurring_outflows_usd: recurring,
      variable_outflows_usd: variable,
      ad_spend_outflows_usd: adSpend,
      inventory_outflows_usd: inventory,
    });
  }

  return {
    as_of_day: input.as_of_day,
    horizon_days: horizonDays,
    starting_balance_usd: roundMoney(input.starting_balance_usd),
    zero_crossing_day: detectZeroCrossingDay(points, input.starting_balance_usd),
    baselines,
    assumptions: input.assumptions,
    points,
  };
}
