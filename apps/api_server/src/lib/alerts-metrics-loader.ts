import { and, eq, gte, lte } from "drizzle-orm";
import { martAdPerformanceDaily, profitLeaks, type Database } from "@morgan/db";
import { addDays } from "@morgan/integrations";
import { STUB_STORE_ID } from "../test/stub-store.js";
import { getCashRunway } from "./cash-runway-service.js";
import { getInventoryHealth } from "./inventory-health-service.js";
import { getMarginDrivers, getProfitOverview } from "./profit-overview-service.js";
import type { CampaignMetrics } from "./ad-waste-alert-engine.js";
import { sampleCampaignMetrics } from "./ad-waste-alert-engine.js";
import type { CashMetrics } from "./cash-crunch-alert-engine.js";
import { sampleCashMetrics } from "./cash-crunch-alert-engine.js";
import type { MarginMetrics } from "./margin-alert-engine.js";
import { sampleMarginMetrics } from "./margin-alert-engine.js";
import type { SkuInventoryMetrics } from "./stockout-alert-engine.js";
import { sampleSkuInventoryMetrics, stockoutRiskThresholdDays } from "./stockout-alert-engine.js";

function isDemoStore(storeId: string): boolean {
  return storeId === STUB_STORE_ID || storeId.endsWith("0002") || storeId === "dev-local-store";
}

export async function loadMarginMetricsForAlerts(
  db: Database,
  storeId: string,
): Promise<MarginMetrics> {
  if (isDemoStore(storeId)) {
    return sampleMarginMetrics(storeId);
  }

  const overview = await getProfitOverview(db, storeId, 7);
  if (overview.current_margin_pct == null || overview.prior_margin_pct == null) {
    return sampleMarginMetrics(storeId);
  }

  const drivers = await getMarginDrivers(db, storeId, 7);
  const topDriver = drivers.drivers[0]?.label ?? "Review margin drivers in Profit";

  return {
    current_margin_pct: overview.current_margin_pct,
    trailing_7d_avg_pct: overview.prior_margin_pct,
    top_driver: topDriver,
  };
}

function buildDailyPoasFromRows(
  rows: Array<typeof martAdPerformanceDaily.$inferSelect>,
): CampaignMetrics[] {
  const byCampaign = new Map<string, Array<typeof martAdPerformanceDaily.$inferSelect>>();

  for (const row of rows) {
    const key = `${row.channel}|${row.campaignId}`;
    const group = byCampaign.get(key) ?? [];
    group.push(row);
    byCampaign.set(key, group);
  }

  const campaigns: CampaignMetrics[] = [];

  for (const [, campaignRows] of byCampaign) {
    const sorted = [...campaignRows].sort((a, b) => a.performanceDate.localeCompare(b.performanceDate));
    const recent = sorted.slice(-7);
    const spend7d = recent.reduce((sum, row) => sum + Number(row.adSpend ?? 0), 0);
    const margin7d = recent.reduce(
      (sum, row) => sum + Number(row.attributedContributionMargin ?? 0),
      0,
    );
    const poas7d = spend7d > 0 ? margin7d / spend7d : 0;
    const first = sorted[0];
    if (!first) continue;

    campaigns.push({
      campaign_id: first.campaignId,
      campaign_name: first.campaignName,
      poas_7d: poas7d,
      spend_7d_usd: spend7d,
      daily_poas: recent.map((row) => ({
        date: row.performanceDate,
        poas:
          Number(row.adSpend ?? 0) > 0
            ? Number(row.attributedContributionMargin ?? 0) / Number(row.adSpend)
            : 0,
        spend_usd: Number(row.adSpend ?? 0),
      })),
      recommendation_id: first.campaignId,
      suggested_action: "Pause campaign or cut daily budget by 50%",
    });
  }

  return campaigns;
}

export async function loadCampaignMetricsForAlerts(
  db: Database,
  storeId: string,
): Promise<CampaignMetrics[]> {
  if (isDemoStore(storeId)) {
    return sampleCampaignMetrics(storeId);
  }

  const referenceDay = new Date().toISOString().slice(0, 10);
  const sinceDay = addDays(referenceDay, -6);

  const [spendRows, leakRows] = await Promise.all([
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
    db
      .select({ externalKey: profitLeaks.externalKey, id: profitLeaks.id })
      .from(profitLeaks)
      .where(and(eq(profitLeaks.storeId, storeId), eq(profitLeaks.leakType, "ad_waste"))),
  ]);

  const recommendationByCampaign = new Map(
    leakRows.map((row) => [row.externalKey, row.id] as const),
  );

  const campaigns = buildDailyPoasFromRows(spendRows).map((campaign) => ({
    ...campaign,
    recommendation_id: recommendationByCampaign.get(campaign.campaign_id) ?? campaign.campaign_id,
  }));

  if (campaigns.length === 0) {
    return sampleCampaignMetrics(storeId);
  }

  return campaigns;
}

export async function loadSkuInventoryMetricsForAlerts(
  db: Database,
  storeId: string,
): Promise<SkuInventoryMetrics[]> {
  if (isDemoStore(storeId)) {
    return sampleSkuInventoryMetrics(storeId);
  }

  const health = await getInventoryHealth(db, storeId);
  if (health.skus.length === 0) {
    return sampleSkuInventoryMetrics(storeId);
  }

  const sorted = [...health.skus].sort((a, b) => b.gross_revenue - a.gross_revenue);
  const total = sorted.length;

  return sorted.map((sku, index) => {
    const revenuePercentile = total <= 1 ? 100 : Math.round((1 - index / total) * 100);
    const daysOfStock = sku.days_of_stock ?? 0;

    return {
      sku_id: sku.sku,
      sku_name: sku.title ?? sku.sku,
      days_of_stock: daysOfStock,
      lead_time_days: sku.lead_time_days,
      revenue_percentile: revenuePercentile,
      recommendation_id: sku.sku,
    };
  }).filter(
    (sku) =>
      sku.revenue_percentile >= 80 &&
      sku.days_of_stock < stockoutRiskThresholdDays(sku.lead_time_days),
  );
}

export async function loadCashMetricsForAlerts(
  db: Database,
  storeId: string,
): Promise<CashMetrics | null> {
  if (isDemoStore(storeId)) {
    return sampleCashMetrics(storeId);
  }

  const runway = await getCashRunway(db, storeId);
  if (!runway.available || runway.runway_days == null) {
    return null;
  }

  const balance = Number(runway.current_balance ?? 0);
  const burn = Number(runway.avg_daily_net_outflow ?? 0);

  return {
    cash_balance_usd: balance,
    daily_burn_usd: burn,
    runway_days: runway.runway_days,
    suggested_actions: [
      runway.runway_status === "critical"
        ? "Pause discretionary ad spend"
        : "Review upcoming payables",
      "Ask Morgan for cash levers",
    ],
  };
}
