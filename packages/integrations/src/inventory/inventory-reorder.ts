export const INVENTORY_REORDER_TOP_N = 50;
export const STOCKOUT_URGENT_DAYS = 3;
export const SAFETY_STOCK_Z_SCORE = 1.65;

export function computeDemandStdDev(dailyUnits: number[]): number {
  if (dailyUnits.length === 0) return 0;

  const mean = dailyUnits.reduce((sum, units) => sum + units, 0) / dailyUnits.length;
  if (dailyUnits.length === 1) {
    return Math.sqrt(Math.max(mean, 0));
  }

  const variance =
    dailyUnits.reduce((sum, units) => sum + (units - mean) ** 2, 0) / dailyUnits.length;
  return Math.sqrt(Math.max(variance, 0));
}

export function computeSafetyStockUnits(
  demandStdDev: number,
  leadTimeDays: number,
  zScore = SAFETY_STOCK_Z_SCORE,
): number {
  if (demandStdDev <= 0 || leadTimeDays <= 0) return 0;
  return Math.ceil(zScore * demandStdDev * Math.sqrt(leadTimeDays));
}

export function computeReorderPointUnits(
  avgDailyVelocity: number,
  leadTimeDays: number,
  safetyStockUnits: number,
): number {
  if (avgDailyVelocity <= 0) return safetyStockUnits;
  return avgDailyVelocity * leadTimeDays + safetyStockUnits;
}

export function computeReorderQty(
  reorderPointUnits: number,
  currentStock: number,
  avgDailyVelocity: number,
  leadTimeDays: number,
): number {
  if (avgDailyVelocity <= 0) return 0;
  return Math.max(
    0,
    Math.ceil(reorderPointUnits - currentStock + avgDailyVelocity * leadTimeDays),
  );
}

export function computeReorderCostUsd(reorderQty: number, unitCost: number | null): number {
  if (reorderQty <= 0 || unitCost == null || unitCost <= 0) return 0;
  return Math.round(reorderQty * unitCost);
}

export function computeRunwayImpactDays(
  reorderCostUsd: number,
  avgDailyNetOutflow: number | null,
): number | null {
  if (reorderCostUsd <= 0 || avgDailyNetOutflow == null || avgDailyNetOutflow <= 0) {
    return null;
  }
  return Math.round((reorderCostUsd / avgDailyNetOutflow) * 10) / 10;
}

export function isEligibleForReorderRecommendation(input: {
  reorder_recommended: boolean;
  revenue_rank: number | null;
  days_of_stock: number | null;
  top_n?: number;
  urgent_stockout_days?: number;
}): boolean {
  if (!input.reorder_recommended) return false;

  const topN = input.top_n ?? INVENTORY_REORDER_TOP_N;
  const urgentDays = input.urgent_stockout_days ?? STOCKOUT_URGENT_DAYS;
  const rank = input.revenue_rank ?? Number.MAX_SAFE_INTEGER;

  if (rank <= topN) return true;
  return input.days_of_stock != null && input.days_of_stock < urgentDays;
}

export function buildReorderRecommendationCopy(input: {
  sku: string;
  reorder_qty: number;
  reorder_cost_usd: number;
  reorder_by_day: string;
  runway_impact_days: number | null;
  avg_daily_velocity: number;
  days_of_stock: number | null;
}): { title: string; body: string } {
  const costText =
    input.reorder_cost_usd > 0
      ? `$${input.reorder_cost_usd.toLocaleString("en-US")}`
      : "cost TBD";
  const runwayText =
    input.runway_impact_days != null
      ? ` Cash runway impact: ~${input.runway_impact_days} day${input.runway_impact_days === 1 ? "" : "s"}.`
      : "";

  const daysText =
    input.days_of_stock != null
      ? ` About ${input.days_of_stock.toFixed(0)} days of stock remain at ${input.avg_daily_velocity.toFixed(1)}/day.`
      : "";

  return {
    title: `Reorder ${input.sku}`,
    body: `Order ${input.reorder_qty} units of ${input.sku} by ${input.reorder_by_day} (est. cost ${costText}).${daysText}${runwayText}`,
  };
}
