import { and, eq, gte, lte } from "drizzle-orm";
import { martAdPerformanceDaily, metricSnapshots } from "@morgan/db";
import {
  addDays,
  buildSkuWeeklyTrend,
  parseSkuWeeklyRow,
  rankSkusByContributionProfit,
  sumAdSpendForMer,
  summarizeSkuWindow,
  type SkuWeeklyEconomicsRow,
  type SkuWeeklyTrendPoint,
  type SkuWindowSummary,
} from "@morgan/integrations";
import type { Database } from "@morgan/db";
import { getSqlAgentService } from "./sql-agent-service.js";
import { isGoogleAdsConnected, isMetaConnected } from "./poas-service.js";

export type ProfitSkuListView = {
  store_id: string;
  window_days: number;
  reference_day: string;
  total_ad_spend: number;
  skus: SkuWindowSummary[];
};

export type ProfitSkuDetailView = {
  store_id: string;
  sku: string;
  window_days: number;
  reference_day: string;
  summary: SkuWindowSummary;
  weekly_trend: SkuWeeklyTrendPoint[];
};

async function fetchSkuWeeklyRows(
  storeId: string,
  startDate: string,
  endDate: string,
): Promise<SkuWeeklyEconomicsRow[]> {
  const agent = await getSqlAgentService();
  if (!agent) return [];

  const result = await agent.runStandardMetricQuery("sku_economics", {
    store_id: storeId,
    start_date: startDate,
    end_date: endDate,
  });

  return result.rows
    .map((row) => parseSkuWeeklyRow(row))
    .filter((row): row is SkuWeeklyEconomicsRow => row != null);
}

async function fetchTotalAdSpend(
  db: Database,
  storeId: string,
  startDate: string,
  endDate: string,
  googleAdsConnected: boolean,
): Promise<number> {
  const adRows = await db
    .select()
    .from(martAdPerformanceDaily)
    .where(
      and(
        eq(martAdPerformanceDaily.storeId, storeId),
        gte(martAdPerformanceDaily.performanceDate, startDate),
        lte(martAdPerformanceDaily.performanceDate, endDate),
      ),
    );

  if (adRows.length > 0) {
    return sumAdSpendForMer(
      adRows.map((row) => ({ channel: row.channel, ad_spend: row.adSpend })),
      googleAdsConnected,
    );
  }

  const metricKey = endDate >= addDays(new Date().toISOString().slice(0, 10), -6) ? "ad_spend_7d" : null;
  if (!metricKey) return 0;

  const [snapshot] = await db
    .select({ value: metricSnapshots.value })
    .from(metricSnapshots)
    .where(
      and(
        eq(metricSnapshots.storeId, storeId),
        eq(metricSnapshots.metricKey, metricKey),
        eq(metricSnapshots.period, "7d"),
      ),
    )
    .limit(1);

  return snapshot ? Number(snapshot.value) : 0;
}

export async function getProfitSkuRanking(
  db: Database,
  storeId: string,
  windowDays = 30,
): Promise<ProfitSkuListView> {
  const referenceDay = new Date().toISOString().slice(0, 10);
  const startDate = addDays(referenceDay, -(windowDays - 1));
  const googleAdsConnected = await isGoogleAdsConnected(db, storeId);

  const [rows, totalAdSpend] = await Promise.all([
    fetchSkuWeeklyRows(storeId, startDate, referenceDay),
    fetchTotalAdSpend(db, storeId, startDate, referenceDay, googleAdsConnected),
  ]);

  return {
    store_id: storeId,
    window_days: windowDays,
    reference_day: referenceDay,
    total_ad_spend: totalAdSpend,
    skus: rankSkusByContributionProfit(rows, totalAdSpend),
  };
}

export async function getProfitSkuDetail(
  db: Database,
  storeId: string,
  sku: string,
  windowDays = 30,
): Promise<ProfitSkuDetailView | null> {
  const referenceDay = new Date().toISOString().slice(0, 10);
  const startDate = addDays(referenceDay, -(windowDays - 1));
  const googleAdsConnected = await isGoogleAdsConnected(db, storeId);

  const [rows, totalAdSpend] = await Promise.all([
    fetchSkuWeeklyRows(storeId, startDate, referenceDay),
    fetchTotalAdSpend(db, storeId, startDate, referenceDay, googleAdsConnected),
  ]);

  const totalGrossRevenue = rows.reduce((sum, row) => sum + row.gross_revenue, 0);
  const summary = summarizeSkuWindow(rows, sku, totalAdSpend, totalGrossRevenue);
  if (!summary) return null;

  return {
    store_id: storeId,
    sku,
    window_days: windowDays,
    reference_day: referenceDay,
    summary,
    weekly_trend: buildSkuWeeklyTrend(rows, sku),
  };
}

export async function isProfitDashboardAvailable(db: Database, storeId: string): Promise<boolean> {
  const agent = await getSqlAgentService();
  return agent != null || (await isMetaConnected(db, storeId));
}
