import { and, desc, eq, gte, lte } from "drizzle-orm";
import {
  cashRunwaySnapshots,
  martAdPerformanceDaily,
  metricSnapshots,
  type Database,
} from "@morgan/db";
import {
  addDays,
  aggregatePoas7d,
  detectChatIntent,
  merchantLocalYesterday,
  type ChatDataContext,
  type DailyProfitPoint,
} from "@morgan/integrations";
import { loadStoreBriefingConfig } from "./briefing-generation-service.js";
import { getSqlAgentService } from "./sql-agent-service.js";
import {
  getTopOpenRecommendation,
  recommendationToChatContext,
} from "./recommendation-service.js";

async function fetchProfitSeriesFromClickHouse(
  storeId: string,
  startDate: string,
  endDate: string,
): Promise<DailyProfitPoint[]> {
  const agent = await getSqlAgentService();
  if (!agent) return [];

  const result = await agent.runStandardMetricQuery("orders_daily", {
    store_id: storeId,
    start_date: startDate,
    end_date: endDate,
  });

  return result.rows
    .map((row) => ({
      day: String(row.day ?? ""),
      contribution_margin: Number(row.contribution_margin ?? 0),
      net_revenue: Number(row.net_revenue ?? 0),
    }))
    .filter((row) => row.day.length > 0);
}

async function fetchAdSpend7d(db: Database, storeId: string): Promise<number | null> {
  const [snapshot] = await db
    .select({ value: metricSnapshots.value })
    .from(metricSnapshots)
    .where(and(eq(metricSnapshots.storeId, storeId), eq(metricSnapshots.metricKey, "ad_spend_7d")))
    .limit(1);

  if (snapshot) {
    const value = Number(snapshot.value);
    if (Number.isFinite(value) && value > 0) return value;
  }

  const rows = await db
    .select({ adSpend: martAdPerformanceDaily.adSpend })
    .from(martAdPerformanceDaily)
    .where(
      and(eq(martAdPerformanceDaily.storeId, storeId), eq(martAdPerformanceDaily.channel, "meta")),
    );

  if (rows.length === 0) return null;
  return rows.reduce((sum, row) => sum + Number(row.adSpend ?? 0), 0);
}

async function fetchChannelAdMetrics7d(
  db: Database,
  storeId: string,
  channel: "meta" | "google",
  startDate: string,
  endDate: string,
): Promise<{ spend: number; poas: number | null }> {
  const rows = await db
    .select({
      adSpend: martAdPerformanceDaily.adSpend,
      margin: martAdPerformanceDaily.attributedContributionMargin,
    })
    .from(martAdPerformanceDaily)
    .where(
      and(
        eq(martAdPerformanceDaily.storeId, storeId),
        eq(martAdPerformanceDaily.channel, channel),
        gte(martAdPerformanceDaily.performanceDate, startDate),
        lte(martAdPerformanceDaily.performanceDate, endDate),
      ),
    );

  if (rows.length === 0) {
    return { spend: 0, poas: null };
  }

  const spend = rows.reduce((sum, row) => sum + Number(row.adSpend ?? 0), 0);
  const poas = aggregatePoas7d(
    rows.map((row) => ({
      ad_spend: Number(row.adSpend ?? 0),
      attributed_contribution_margin: Number(row.margin ?? 0),
    })),
  );

  return { spend, poas };
}

async function fetchRunwaySnapshot(
  db: Database,
  storeId: string,
): Promise<{ runwayDays: number | null; avgDailyNetOutflow: number | null }> {
  const [snapshot] = await db
    .select({
      runwayDays: cashRunwaySnapshots.runwayDays,
      avgDailyNetOutflow: cashRunwaySnapshots.avgDailyNetOutflow,
    })
    .from(cashRunwaySnapshots)
    .where(eq(cashRunwaySnapshots.storeId, storeId))
    .orderBy(desc(cashRunwaySnapshots.asOfDay))
    .limit(1);

  if (!snapshot) {
    return { runwayDays: null, avgDailyNetOutflow: null };
  }

  const runwayDays = snapshot.runwayDays ? Number(snapshot.runwayDays) : null;
  const avgDailyNetOutflow = snapshot.avgDailyNetOutflow
    ? Number(snapshot.avgDailyNetOutflow)
    : null;

  return {
    runwayDays: Number.isFinite(runwayDays) ? runwayDays : null,
    avgDailyNetOutflow: Number.isFinite(avgDailyNetOutflow) ? avgDailyNetOutflow : null,
  };
}

export async function buildChatDataContext(
  db: Database,
  storeId: string,
  message: string,
): Promise<ChatDataContext> {
  const config = await loadStoreBriefingConfig(db, storeId);
  const timezone = config?.timezone ?? "UTC";
  const referenceDay = merchantLocalYesterday(timezone);
  const startDate = addDays(referenceDay, -6);
  const intent = detectChatIntent(message);

  let profitSeries = await fetchProfitSeriesFromClickHouse(storeId, startDate, referenceDay);

  if (profitSeries.length === 0) {
    const [marginSnapshot, revenueSnapshot] = await Promise.all([
      db
        .select({ value: metricSnapshots.value })
        .from(metricSnapshots)
        .where(
          and(
            eq(metricSnapshots.storeId, storeId),
            eq(metricSnapshots.metricKey, "contribution_margin_7d"),
          ),
        )
        .limit(1),
      db
        .select({ value: metricSnapshots.value })
        .from(metricSnapshots)
        .where(and(eq(metricSnapshots.storeId, storeId), eq(metricSnapshots.metricKey, "net_revenue_7d")))
        .limit(1),
    ]);

    const margin = Number(marginSnapshot[0]?.value ?? 0);
    const revenue = Number(revenueSnapshot[0]?.value ?? 0);
    if (Number.isFinite(margin) && margin > 0) {
      profitSeries = [
        {
          day: referenceDay,
          contribution_margin: margin / 7,
          net_revenue: revenue / 7,
        },
      ];
    }
  }

  const [adSpend7d, runwaySnapshot, metaMetrics, googleMetrics, topRecommendationRow] =
    await Promise.all([
      fetchAdSpend7d(db, storeId),
      fetchRunwaySnapshot(db, storeId),
      fetchChannelAdMetrics7d(db, storeId, "meta", startDate, referenceDay),
      fetchChannelAdMetrics7d(db, storeId, "google", startDate, referenceDay),
      getTopOpenRecommendation(db, storeId),
    ]);

  return {
    intent,
    timezone,
    referenceDay,
    profitSeries,
    runwayDays: runwaySnapshot.runwayDays,
    avgDailyNetOutflow: runwaySnapshot.avgDailyNetOutflow,
    adSpend7d:
      adSpend7d != null && adSpend7d > 0
        ? adSpend7d
        : metaMetrics.spend > 0
          ? metaMetrics.spend
          : null,
    metaPoas7d: metaMetrics.poas,
    googleAdSpend7d: googleMetrics.spend > 0 ? googleMetrics.spend : null,
    googlePoas7d: googleMetrics.poas,
    topRecommendation: topRecommendationRow
      ? recommendationToChatContext(topRecommendationRow)
      : null,
  };
}
