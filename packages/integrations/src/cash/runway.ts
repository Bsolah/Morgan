export const CASH_RUNWAY_TRAILING_DAYS = 30;
export const CASH_RUNWAY_WARNING_DAYS = 30;
export const CASH_RUNWAY_CRITICAL_DAYS = 7;

export type RunwayTransaction = {
  date: string;
  amount: number;
};

export function addDaysToDayString(day: string, delta: number): string {
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function buildTrailingDayWindow(
  endDay: string,
  windowDays = CASH_RUNWAY_TRAILING_DAYS,
): { startDay: string; endDay: string; days: string[] } {
  const startDay = addDaysToDayString(endDay, -(windowDays - 1));
  const days: string[] = [];
  for (let index = 0; index < windowDays; index += 1) {
    days.push(addDaysToDayString(startDay, index));
  }
  return { startDay, endDay, days };
}

export function dailyNetOutflowsForWindow(
  transactions: RunwayTransaction[],
  startDay: string,
  endDay: string,
  windowDays = CASH_RUNWAY_TRAILING_DAYS,
): number[] {
  const { days } = buildTrailingDayWindow(endDay, windowDays);
  const netByDay = new Map<string, number>(days.map((day) => [day, 0]));

  for (const transaction of transactions) {
    if (transaction.date < startDay || transaction.date > endDay) continue;
    netByDay.set(transaction.date, (netByDay.get(transaction.date) ?? 0) + transaction.amount);
  }

  return days.map((day) => {
    const netChange = netByDay.get(day) ?? 0;
    return netChange < 0 ? Math.abs(netChange) : 0;
  });
}

export function averageDailyNetOutflow(dailyOutflows: number[]): number {
  if (dailyOutflows.length === 0) return 0;
  return dailyOutflows.reduce((sum, value) => sum + value, 0) / dailyOutflows.length;
}

export function calculateRunwayDays(
  currentBalance: number,
  avgDailyNetOutflow: number,
): number | null {
  if (currentBalance <= 0) return 0;
  if (avgDailyNetOutflow <= 0) return null;
  return Math.round((currentBalance / avgDailyNetOutflow) * 10) / 10;
}

export type RunwayStatus = "healthy" | "warning" | "critical" | "unknown";

export function runwayStatusForDays(runwayDays: number | null): RunwayStatus {
  if (runwayDays == null) return "unknown";
  if (runwayDays < CASH_RUNWAY_CRITICAL_DAYS) return "critical";
  if (runwayDays < CASH_RUNWAY_WARNING_DAYS) return "warning";
  return "healthy";
}

export function computeCashRunway(input: {
  currentBalance: number;
  transactions: RunwayTransaction[];
  asOfDay: string;
  trailingDays?: number;
}): {
  avgDailyNetOutflow: number;
  runwayDays: number | null;
  status: RunwayStatus;
} {
  const trailingDays = input.trailingDays ?? CASH_RUNWAY_TRAILING_DAYS;
  const { startDay, endDay } = buildTrailingDayWindow(input.asOfDay, trailingDays);
  const dailyOutflows = dailyNetOutflowsForWindow(
    input.transactions,
    startDay,
    endDay,
    trailingDays,
  );
  const avgDailyNetOutflow = averageDailyNetOutflow(dailyOutflows);
  const runwayDays = calculateRunwayDays(input.currentBalance, avgDailyNetOutflow);

  return {
    avgDailyNetOutflow: Math.round(avgDailyNetOutflow * 10000) / 10000,
    runwayDays,
    status: runwayStatusForDays(runwayDays),
  };
}
