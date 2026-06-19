import { eq } from "drizzle-orm";
import { merchantFinanceConfig, type Database } from "@morgan/db";
import {
  addDays,
  buildMarginPeriodTotals,
  computeMarginDrivers,
  DEFAULT_SHIPPING_COST_PCT,
  merchantLocalYesterday,
  type MarginDriver,
} from "@morgan/integrations";
import { loadStoreBriefingConfig } from "./briefing-generation-service.js";
import { getSqlAgentService } from "./sql-agent-service.js";

export const DEFAULT_TARGET_MARGIN_PCT = 40;
export const PROFIT_OVERVIEW_WINDOW_DAYS = 30;

export type DailyMarginTrendPoint = {
  day: string;
  margin_pct: number | null;
  contribution_margin: number;
  net_revenue: number;
  orders: number;
};

export type ProfitOverviewView = {
  store_id: string;
  reference_day: string;
  window_days: number;
  current_margin_pct: number | null;
  prior_margin_pct: number | null;
  margin_delta_pct: number | null;
  target_margin_pct: number;
  below_target: boolean;
  trend: DailyMarginTrendPoint[];
};

export type ProfitDaySummaryView = {
  store_id: string;
  day: string;
  orders: number;
  gross_revenue: number;
  net_revenue: number;
  cogs: number;
  contribution_margin: number;
  margin_pct: number | null;
  units_sold: number;
};

export type MarginDriversView = {
  store_id: string;
  reference_day: string;
  window_days: number;
  current_margin_pct: number | null;
  margin_delta_pct: number | null;
  drivers: MarginDriver[];
};

type OrdersDailyRow = {
  day: string;
  orders: number;
  gross_revenue: number;
  net_revenue: number;
  discounts: number;
  shipping_revenue: number;
  cogs: number;
  contribution_margin: number;
  units_sold: number;
};

function marginPct(contributionMargin: number, netRevenue: number): number | null {
  if (netRevenue <= 0) return null;
  return Math.round((contributionMargin / netRevenue) * 1000) / 10;
}

function aggregateMarginPct(rows: OrdersDailyRow[]): number | null {
  const netRevenue = rows.reduce((sum, row) => sum + row.net_revenue, 0);
  const contributionMargin = rows.reduce((sum, row) => sum + row.contribution_margin, 0);
  return marginPct(contributionMargin, netRevenue);
}

function parseOrdersDailyRow(row: Record<string, unknown>): OrdersDailyRow | null {
  const day = String(row.day ?? "");
  if (!day) return null;

  return {
    day,
    orders: Number(row.orders ?? 0),
    gross_revenue: Number(row.gross_revenue ?? 0),
    net_revenue: Number(row.net_revenue ?? 0),
    discounts: Number(row.discounts ?? 0),
    shipping_revenue: Number(row.shipping_revenue ?? 0),
    cogs: Number(row.cogs ?? 0),
    contribution_margin: Number(row.contribution_margin ?? 0),
    units_sold: Number(row.units_sold ?? 0),
  };
}

async function fetchOrdersDailyRows(
  storeId: string,
  startDate: string,
  endDate: string,
): Promise<OrdersDailyRow[]> {
  const agent = await getSqlAgentService();
  if (!agent) return [];

  const result = await agent.runStandardMetricQuery("orders_daily", {
    store_id: storeId,
    start_date: startDate,
    end_date: endDate,
  });

  return result.rows
    .map((row) => parseOrdersDailyRow(row))
    .filter((row): row is OrdersDailyRow => row != null)
    .sort((left, right) => left.day.localeCompare(right.day));
}

async function fetchAdSpendTotal(
  storeId: string,
  startDate: string,
  endDate: string,
): Promise<number> {
  const agent = await getSqlAgentService();
  if (!agent) return 0;

  const result = await agent.runStandardMetricQuery("ad_performance", {
    store_id: storeId,
    start_date: startDate,
    end_date: endDate,
  });

  return result.rows.reduce((sum, row) => sum + Number(row.ad_spend ?? 0), 0);
}

function sumOrdersRows(rows: OrdersDailyRow[]) {
  return rows.reduce(
    (totals, row) => ({
      gross_revenue: totals.gross_revenue + row.gross_revenue,
      discounts: totals.discounts + row.discounts,
      shipping_revenue: totals.shipping_revenue + row.shipping_revenue,
      cogs: totals.cogs + row.cogs,
      contribution_margin: totals.contribution_margin + row.contribution_margin,
    }),
    {
      gross_revenue: 0,
      discounts: 0,
      shipping_revenue: 0,
      cogs: 0,
      contribution_margin: 0,
    },
  );
}

async function loadShippingCostPct(db: Database, storeId: string): Promise<number> {
  const [config] = await db
    .select({ shippingCostPct: merchantFinanceConfig.shippingCostPct })
    .from(merchantFinanceConfig)
    .where(eq(merchantFinanceConfig.storeId, storeId))
    .limit(1);

  const value = Number(config?.shippingCostPct ?? DEFAULT_SHIPPING_COST_PCT);
  return Number.isFinite(value) ? value : DEFAULT_SHIPPING_COST_PCT;
}

async function loadTargetMarginPct(db: Database, storeId: string): Promise<number> {
  const [config] = await db
    .select({ target: merchantFinanceConfig.targetContributionMarginPct })
    .from(merchantFinanceConfig)
    .where(eq(merchantFinanceConfig.storeId, storeId))
    .limit(1);

  const value = Number(config?.target ?? DEFAULT_TARGET_MARGIN_PCT);
  return Number.isFinite(value) ? value : DEFAULT_TARGET_MARGIN_PCT;
}

function buildTrendPoints(rows: OrdersDailyRow[]): DailyMarginTrendPoint[] {
  return rows.map((row) => ({
    day: row.day,
    margin_pct: marginPct(row.contribution_margin, row.net_revenue),
    contribution_margin: row.contribution_margin,
    net_revenue: row.net_revenue,
    orders: row.orders,
  }));
}

export async function getMarginDrivers(
  db: Database,
  storeId: string,
  windowDays = PROFIT_OVERVIEW_WINDOW_DAYS,
): Promise<MarginDriversView> {
  const config = await loadStoreBriefingConfig(db, storeId);
  const timezone = config?.timezone ?? "UTC";
  const referenceDay = merchantLocalYesterday(timezone);
  const currentStart = addDays(referenceDay, -(windowDays - 1));
  const priorEnd = addDays(currentStart, -1);
  const priorStart = addDays(priorEnd, -(windowDays - 1));

  const [rows, shippingCostPct, currentAdSpend, priorAdSpend] = await Promise.all([
    fetchOrdersDailyRows(storeId, priorStart, referenceDay),
    loadShippingCostPct(db, storeId),
    fetchAdSpendTotal(storeId, currentStart, referenceDay),
    fetchAdSpendTotal(storeId, priorStart, priorEnd),
  ]);

  const currentRows = rows.filter((row) => row.day >= currentStart && row.day <= referenceDay);
  const priorRows = rows.filter((row) => row.day >= priorStart && row.day <= priorEnd);

  const currentMarginPct = aggregateMarginPct(currentRows);
  const priorMarginPct = aggregateMarginPct(priorRows);
  const marginDeltaPct =
    currentMarginPct != null && priorMarginPct != null
      ? Math.round((currentMarginPct - priorMarginPct) * 10) / 10
      : null;

  const currentTotals = sumOrdersRows(currentRows);
  const priorTotals = sumOrdersRows(priorRows);

  const drivers = computeMarginDrivers(
    buildMarginPeriodTotals({
      ...currentTotals,
      ad_spend: currentAdSpend,
      shipping_cost_pct: shippingCostPct,
    }),
    buildMarginPeriodTotals({
      ...priorTotals,
      ad_spend: priorAdSpend,
      shipping_cost_pct: shippingCostPct,
    }),
    windowDays,
  );

  return {
    store_id: storeId,
    reference_day: referenceDay,
    window_days: windowDays,
    current_margin_pct: currentMarginPct,
    margin_delta_pct: marginDeltaPct,
    drivers,
  };
}

export async function getProfitOverview(
  db: Database,
  storeId: string,
  windowDays = PROFIT_OVERVIEW_WINDOW_DAYS,
): Promise<ProfitOverviewView> {
  const config = await loadStoreBriefingConfig(db, storeId);
  const timezone = config?.timezone ?? "UTC";
  const referenceDay = merchantLocalYesterday(timezone);
  const currentStart = addDays(referenceDay, -(windowDays - 1));
  const priorEnd = addDays(currentStart, -1);
  const priorStart = addDays(priorEnd, -(windowDays - 1));

  const [rows, targetMarginPct] = await Promise.all([
    fetchOrdersDailyRows(storeId, priorStart, referenceDay),
    loadTargetMarginPct(db, storeId),
  ]);

  const currentRows = rows.filter((row) => row.day >= currentStart && row.day <= referenceDay);
  const priorRows = rows.filter((row) => row.day >= priorStart && row.day <= priorEnd);

  const currentMarginPct = aggregateMarginPct(currentRows);
  const priorMarginPct = aggregateMarginPct(priorRows);
  const marginDeltaPct =
    currentMarginPct != null && priorMarginPct != null
      ? Math.round((currentMarginPct - priorMarginPct) * 10) / 10
      : null;

  return {
    store_id: storeId,
    reference_day: referenceDay,
    window_days: windowDays,
    current_margin_pct: currentMarginPct,
    prior_margin_pct: priorMarginPct,
    margin_delta_pct: marginDeltaPct,
    target_margin_pct: targetMarginPct,
    below_target: currentMarginPct != null ? currentMarginPct < targetMarginPct : false,
    trend: buildTrendPoints(currentRows),
  };
}

export async function getProfitDaySummary(
  db: Database,
  storeId: string,
  day: string,
): Promise<ProfitDaySummaryView | null> {
  const rows = await fetchOrdersDailyRows(storeId, day, day);
  const row = rows.find((entry) => entry.day === day);
  if (!row) return null;

  return {
    store_id: storeId,
    day: row.day,
    orders: row.orders,
    gross_revenue: row.gross_revenue,
    net_revenue: row.net_revenue,
    cogs: row.cogs,
    contribution_margin: row.contribution_margin,
    margin_pct: marginPct(row.contribution_margin, row.net_revenue),
    units_sold: row.units_sold,
  };
}

export function computeMarginPct(contributionMargin: number, netRevenue: number): number | null {
  return marginPct(contributionMargin, netRevenue);
}
