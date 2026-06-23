export const LOW_CONFIDENCE_ORDER_THRESHOLD = 30;

export type SkuWeeklyEconomicsRow = {
  sku: string;
  week_start: string;
  orders_count: number;
  units_sold: number;
  gross_revenue: number;
  contribution_margin: number;
  unit_margin: number;
  velocity_per_day: number;
  return_rate: number;
};

export type SkuWindowSummary = {
  sku: string;
  orders_count: number;
  units_sold: number;
  gross_revenue: number;
  contribution_margin: number;
  unit_margin: number;
  velocity_per_day: number;
  return_rate: number;
  low_confidence: boolean;
  attributed_ad_spend: number;
};

export type SkuWeeklyTrendPoint = {
  week_start: string;
  contribution_margin: number;
  unit_margin: number;
  return_rate: number;
  velocity_per_day: number;
  orders_count: number;
};

export function parseSkuWeeklyRow(row: Record<string, unknown>): SkuWeeklyEconomicsRow | null {
  const sku = row.sku;
  if (typeof sku !== "string" || sku.length === 0) return null;

  const weekStart = row.week_start;
  const week =
    typeof weekStart === "string"
      ? weekStart.slice(0, 10)
      : weekStart instanceof Date
        ? weekStart.toISOString().slice(0, 10)
        : String(weekStart ?? "").slice(0, 10);
  if (!week) return null;

  const unitsSold = Number(row.units_sold ?? 0);
  const contributionMargin = Number(row.contribution_margin ?? 0);

  return {
    sku,
    week_start: week,
    orders_count: Number(row.orders_count ?? 0),
    units_sold: unitsSold,
    gross_revenue: Number(row.gross_revenue ?? 0),
    contribution_margin: contributionMargin,
    unit_margin:
      unitsSold > 0
        ? Number(row.unit_margin ?? contributionMargin / unitsSold)
        : Number(row.unit_margin ?? 0),
    velocity_per_day: Number(row.velocity_per_day ?? 0),
    return_rate: Number(row.return_rate ?? 0),
  };
}

export function isLowConfidenceSku(ordersCount: number): boolean {
  return ordersCount < LOW_CONFIDENCE_ORDER_THRESHOLD;
}

export function allocateAttributedAdSpend(
  skuGrossRevenue: number,
  totalGrossRevenue: number,
  totalAdSpend: number,
): number {
  if (totalAdSpend <= 0 || skuGrossRevenue <= 0 || totalGrossRevenue <= 0) {
    return 0;
  }
  return (skuGrossRevenue / totalGrossRevenue) * totalAdSpend;
}

export function summarizeSkuWindow(
  rows: SkuWeeklyEconomicsRow[],
  sku: string,
  totalAdSpend: number,
  totalGrossRevenue: number,
): SkuWindowSummary | null {
  const skuRows = rows.filter((row) => row.sku === sku);
  if (skuRows.length === 0) return null;

  const ordersCount = skuRows.reduce((sum, row) => sum + row.orders_count, 0);
  const unitsSold = skuRows.reduce((sum, row) => sum + row.units_sold, 0);
  const grossRevenue = skuRows.reduce((sum, row) => sum + row.gross_revenue, 0);
  const contributionMargin = skuRows.reduce((sum, row) => sum + row.contribution_margin, 0);
  const weightedReturnRate =
    unitsSold > 0
      ? skuRows.reduce((sum, row) => sum + row.return_rate * row.units_sold, 0) / unitsSold
      : 0;

  return {
    sku,
    orders_count: ordersCount,
    units_sold: unitsSold,
    gross_revenue: grossRevenue,
    contribution_margin: contributionMargin,
    unit_margin: unitsSold > 0 ? contributionMargin / unitsSold : 0,
    velocity_per_day: unitsSold > 0 ? unitsSold / (skuRows.length * 7) : 0,
    return_rate: weightedReturnRate,
    low_confidence: isLowConfidenceSku(ordersCount),
    attributed_ad_spend: allocateAttributedAdSpend(grossRevenue, totalGrossRevenue, totalAdSpend),
  };
}

export function rankSkusByContributionProfit(
  rows: SkuWeeklyEconomicsRow[],
  totalAdSpend: number,
): SkuWindowSummary[] {
  const skuSet = new Set(rows.map((row) => row.sku));
  const totalGrossRevenue = rows.reduce((sum, row) => sum + row.gross_revenue, 0);

  return [...skuSet]
    .map((sku) => summarizeSkuWindow(rows, sku, totalAdSpend, totalGrossRevenue))
    .filter((summary): summary is SkuWindowSummary => summary != null)
    .sort((a, b) => b.contribution_margin - a.contribution_margin);
}

export function buildSkuWeeklyTrend(
  rows: SkuWeeklyEconomicsRow[],
  sku: string,
): SkuWeeklyTrendPoint[] {
  return rows
    .filter((row) => row.sku === sku)
    .sort((a, b) => a.week_start.localeCompare(b.week_start))
    .map((row) => ({
      week_start: row.week_start,
      contribution_margin: row.contribution_margin,
      unit_margin: row.unit_margin,
      return_rate: row.return_rate,
      velocity_per_day: row.velocity_per_day,
      orders_count: row.orders_count,
    }));
}
