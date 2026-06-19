import { and, eq, gte, lte } from "drizzle-orm";
import { martAdPerformanceDaily, type Database } from "@morgan/db";
import {
  bucketMerChannelSpend,
  buildMerChannelBreakdown,
  buildMerDailyTrend,
  calculateMer,
  extractOrderDay,
  MER_TOOLTIP,
  parseOrderRevenue,
  type MerChannelBreakdownRow,
  type MerDailyTrendPoint,
} from "@morgan/integrations";
import { env } from "../config.js";
import { parseOrderPayload, readOrderFactsForStore } from "./order-fact-reader.js";
import { isGoogleAdsConnected, isMetaConnected } from "./poas-service.js";

function addDays(isoDay: string, days: number): string {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export type MarketingMerView = {
  reference_day: string;
  window_days: number;
  trend_days: number;
  net_revenue: number;
  blended_mer: number | null;
  meta_connected: boolean;
  google_ads_connected: boolean;
  channels: MerChannelBreakdownRow[];
  trend: MerDailyTrendPoint[];
  tooltips: {
    mer: string;
  };
};

async function loadDailyNetRevenueByDay(
  storeId: string,
  sinceDay: string,
  untilDay: string,
): Promise<Map<string, number>> {
  const orderRows = await readOrderFactsForStore(env.BRONZE_STORAGE_PATH, storeId, sinceDay, untilDay);
  const byDay = new Map<string, number>();

  for (const row of orderRows) {
    const payload = parseOrderPayload(row);
    const day = extractOrderDay(payload);
    if (!day) continue;
    byDay.set(day, (byDay.get(day) ?? 0) + parseOrderRevenue(payload));
  }

  return byDay;
}

export async function getMarketingMer(
  db: Database,
  storeId: string,
  windowDays = 30,
  trendDays = 30,
): Promise<MarketingMerView> {
  const referenceDay = new Date().toISOString().slice(0, 10);
  const windowSinceDay = addDays(referenceDay, -(windowDays - 1));
  const trendSinceDay = addDays(referenceDay, -(trendDays - 1));
  const sinceDay = windowSinceDay < trendSinceDay ? windowSinceDay : trendSinceDay;

  const [metaConnected, googleAdsConnected, adRows, netRevenueByDay] = await Promise.all([
    isMetaConnected(db, storeId),
    isGoogleAdsConnected(db, storeId),
    db
      .select()
      .from(martAdPerformanceDaily)
      .where(
        and(
          eq(martAdPerformanceDaily.storeId, storeId),
          gte(martAdPerformanceDaily.performanceDate, sinceDay),
          lte(martAdPerformanceDaily.performanceDate, referenceDay),
        ),
      ),
    loadDailyNetRevenueByDay(storeId, sinceDay, referenceDay),
  ]);

  const windowAdRows = adRows
    .filter((row) => row.performanceDate >= windowSinceDay)
    .map((row) => ({
      channel: row.channel,
      ad_spend: Number(row.adSpend),
    }));

  let netRevenue = 0;
  for (const [day, revenue] of netRevenueByDay) {
    if (day >= windowSinceDay && day <= referenceDay) {
      netRevenue += revenue;
    }
  }

  const channelSpend = bucketMerChannelSpend(windowAdRows, googleAdsConnected);
  const trendAdRows = adRows.map((row) => ({
    day: row.performanceDate,
    channel: row.channel,
    ad_spend: Number(row.adSpend),
  }));

  return {
    reference_day: referenceDay,
    window_days: windowDays,
    trend_days: trendDays,
    net_revenue: netRevenue,
    blended_mer: calculateMer(channelSpend.blended, netRevenue),
    meta_connected: metaConnected,
    google_ads_connected: googleAdsConnected,
    channels: buildMerChannelBreakdown(channelSpend, netRevenue, googleAdsConnected),
    trend: buildMerDailyTrend({
      adRows: trendAdRows,
      netRevenueByDay,
      trendDays,
      referenceDay,
      googleAdsConnected,
    }),
    tooltips: {
      mer: MER_TOOLTIP,
    },
  };
}
