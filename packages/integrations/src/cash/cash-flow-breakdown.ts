import {
  buildTrailingDayWindow,
  CASH_RUNWAY_TRAILING_DAYS,
  type RunwayTransaction,
} from "./runway.js";

export type DailyCashFlowPoint = {
  day: string;
  inflows_usd: number;
  outflows_usd: number;
};

export function buildDailyCashFlowBreakdown(
  transactions: RunwayTransaction[],
  asOfDay: string,
  windowDays = CASH_RUNWAY_TRAILING_DAYS,
): DailyCashFlowPoint[] {
  const { startDay, endDay, days } = buildTrailingDayWindow(asOfDay, windowDays);
  const byDay = new Map<string, { inflows: number; outflows: number }>(
    days.map((day) => [day, { inflows: 0, outflows: 0 }]),
  );

  for (const transaction of transactions) {
    if (transaction.date < startDay || transaction.date > endDay) continue;
    const bucket = byDay.get(transaction.date);
    if (!bucket) continue;

    if (transaction.amount > 0) {
      bucket.inflows += transaction.amount;
    } else if (transaction.amount < 0) {
      bucket.outflows += Math.abs(transaction.amount);
    }
  }

  return days.map((day) => {
    const bucket = byDay.get(day) ?? { inflows: 0, outflows: 0 };
    return {
      day,
      inflows_usd: Math.round(bucket.inflows * 100) / 100,
      outflows_usd: Math.round(bucket.outflows * 100) / 100,
    };
  });
}
