import { and, eq, gte, lte, sql } from "drizzle-orm";
import {
  integrations,
  martAdPerformanceDaily,
  metricSnapshots,
  profitLeaks,
  stores,
  type Database,
} from "@morgan/db";
import { calculateMer, MER_TOOLTIP, ROAS_TOOLTIP, sumAdSpendForMer } from "@morgan/integrations";
import type { SqlAgentService } from "@morgan/warehouse";
import { getSqlAgentService } from "./sql-agent-service.js";

export const METRIC_SNAPSHOT_PERIOD_7D = "7d";
export const METRIC_SNAPSHOT_PERIOD_30D = "30d";
export const METRIC_SNAPSHOT_STALE_HOURS = 6;

export const HOME_METRIC_KEYS = [
  "net_revenue_7d",
  "net_revenue_30d",
  "contribution_margin_7d",
  "orders_7d",
  "ad_spend_7d",
  "poas_7d",
  "roas_7d",
  "mer_7d",
  "mer_30d",
  "active_profit_leaks",
  "profit_at_risk_usd",
] as const;

export type HomeMetricKey = (typeof HOME_METRIC_KEYS)[number];

export type MetricSnapshotRow = {
  metric_key: string;
  value: string;
  period: string;
  as_of: string;
  source: string;
};

export type StoreMetricsView = {
  store_id: string;
  snapshots_as_of: string | null;
  is_stale: boolean;
  stale_after_hours: number;
  meta_connected: boolean;
  tooltips: {
    mer: string;
    roas: string;
  };
  metrics: MetricSnapshotRow[];
};

type SnapshotInput = {
  metricKey: string;
  value: number;
  period: string;
  source: string;
  asOf: Date;
};

function addDays(isoDay: string, days: number): string {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatMoney(value: number): string {
  return value.toFixed(4);
}

function sumNumber(rows: Record<string, unknown>[], field: string): number {
  return rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
}

async function isGoogleAdsConnected(db: Database, storeId: string): Promise<boolean> {
  const [integration] = await db
    .select({ status: integrations.status })
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "google_ads")))
    .limit(1);

  return integration?.status === "connected" || integration?.status === "syncing";
}

async function isMetaConnected(db: Database, storeId: string): Promise<boolean> {
  const [integration] = await db
    .select({ status: integrations.status })
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.provider, "meta")))
    .limit(1);

  return integration?.status === "connected" || integration?.status === "syncing";
}

async function readNetRevenueSnapshot(
  db: Database,
  storeId: string,
  period: string,
): Promise<number | null> {
  const metricKey = period === METRIC_SNAPSHOT_PERIOD_30D ? "net_revenue_30d" : "net_revenue_7d";
  const [row] = await db
    .select({ value: metricSnapshots.value })
    .from(metricSnapshots)
    .where(
      and(
        eq(metricSnapshots.storeId, storeId),
        eq(metricSnapshots.metricKey, metricKey),
        eq(metricSnapshots.period, period),
      ),
    )
    .limit(1);

  if (!row) return null;
  const value = Number(row.value);
  return Number.isFinite(value) ? value : null;
}

async function upsertSnapshot(db: Database, storeId: string, input: SnapshotInput): Promise<void> {
  await db
    .insert(metricSnapshots)
    .values({
      storeId,
      metricKey: input.metricKey,
      value: formatMoney(input.value),
      period: input.period,
      asOf: input.asOf,
      source: input.source,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [metricSnapshots.storeId, metricSnapshots.metricKey, metricSnapshots.period],
      set: {
        value: formatMoney(input.value),
        asOf: input.asOf,
        source: input.source,
        updatedAt: new Date(),
      },
    });
}

async function refreshFromClickHouse(
  db: Database,
  storeId: string,
  agent: SqlAgentService,
  referenceDay: string,
  googleAdsConnected: boolean,
): Promise<void> {
  const asOf = new Date();

  for (const window of [
    { days: 7, period: METRIC_SNAPSHOT_PERIOD_7D },
    { days: 30, period: METRIC_SNAPSHOT_PERIOD_30D },
  ] as const) {
    const startDate = addDays(referenceDay, -(window.days - 1));
    const params = {
      store_id: storeId,
      start_date: startDate,
      end_date: referenceDay,
    };

    const [orders, ads] = await Promise.all([
      agent.runStandardMetricQuery("orders_daily", params),
      agent.runStandardMetricQuery("ad_performance", params),
    ]);

    const netRevenue = sumNumber(orders.rows, "net_revenue");
    const contributionMargin = sumNumber(orders.rows, "contribution_margin");
    const ordersCount = sumNumber(orders.rows, "orders");
    const adSpend = sumAdSpendForMer(
      ads.rows.map((row) => ({
        channel: String(row.channel ?? "meta"),
        ad_spend: row.ad_spend,
      })),
      googleAdsConnected,
    );
    const attributedRevenue = sumNumber(ads.rows, "attributed_revenue");
    const attributedMargin = sumNumber(ads.rows, "attributed_contribution_margin");
    const mer = calculateMer(adSpend, netRevenue) ?? 0;

    const snapshots: SnapshotInput[] = [
      {
        metricKey: window.period === METRIC_SNAPSHOT_PERIOD_7D ? "net_revenue_7d" : "net_revenue_30d",
        value: netRevenue,
        period: window.period,
        source: "mart_orders_daily",
        asOf,
      },
    ];

    if (window.period === METRIC_SNAPSHOT_PERIOD_7D) {
      snapshots.push(
        {
          metricKey: "contribution_margin_7d",
          value: contributionMargin,
          period: METRIC_SNAPSHOT_PERIOD_7D,
          source: "mart_orders_daily",
          asOf,
        },
        {
          metricKey: "orders_7d",
          value: ordersCount,
          period: METRIC_SNAPSHOT_PERIOD_7D,
          source: "mart_orders_daily",
          asOf,
        },
        {
          metricKey: "ad_spend_7d",
          value: adSpend,
          period: METRIC_SNAPSHOT_PERIOD_7D,
          source: "mart_ad_performance",
          asOf,
        },
        {
          metricKey: "poas_7d",
          value: adSpend > 0 ? attributedMargin / adSpend : 0,
          period: METRIC_SNAPSHOT_PERIOD_7D,
          source: "mart_ad_performance",
          asOf,
        },
        {
          metricKey: "roas_7d",
          value: adSpend > 0 ? attributedRevenue / adSpend : 0,
          period: METRIC_SNAPSHOT_PERIOD_7D,
          source: "mart_ad_performance",
          asOf,
        },
      );
    }

    snapshots.push({
      metricKey: window.period === METRIC_SNAPSHOT_PERIOD_7D ? "mer_7d" : "mer_30d",
      value: mer,
      period: window.period,
      source: "mart_orders_daily",
      asOf,
    });

    for (const snapshot of snapshots) {
      await upsertSnapshot(db, storeId, snapshot);
    }
  }
}

async function refreshFromPostgres(
  db: Database,
  storeId: string,
  referenceDay: string,
  googleAdsConnected: boolean,
): Promise<void> {
  const asOf = new Date();

  for (const window of [
    { days: 7, period: METRIC_SNAPSHOT_PERIOD_7D },
    { days: 30, period: METRIC_SNAPSHOT_PERIOD_30D },
  ] as const) {
    const startDate = addDays(referenceDay, -(window.days - 1));

    const adRows = await db
      .select()
      .from(martAdPerformanceDaily)
      .where(
        and(
          eq(martAdPerformanceDaily.storeId, storeId),
          gte(martAdPerformanceDaily.performanceDate, startDate),
          lte(martAdPerformanceDaily.performanceDate, referenceDay),
        ),
      );

    const adSpend = sumAdSpendForMer(
      adRows.map((row) => ({ channel: row.channel, ad_spend: row.adSpend })),
      googleAdsConnected,
    );
    const netRevenue = (await readNetRevenueSnapshot(db, storeId, window.period)) ?? 0;
    const mer = calculateMer(adSpend, netRevenue) ?? 0;

    if (window.period === METRIC_SNAPSHOT_PERIOD_7D) {
      const attributedRevenue = adRows.reduce(
        (sum, row) => sum + Number(row.attributedRevenue ?? 0),
        0,
      );
      const attributedMargin = adRows.reduce(
        (sum, row) => sum + Number(row.attributedContributionMargin ?? 0),
        0,
      );

      const snapshots: SnapshotInput[] = [
        {
          metricKey: "ad_spend_7d",
          value: adSpend,
          period: METRIC_SNAPSHOT_PERIOD_7D,
          source: "mart_ad_performance_daily",
          asOf,
        },
        {
          metricKey: "poas_7d",
          value: adSpend > 0 ? attributedMargin / adSpend : 0,
          period: METRIC_SNAPSHOT_PERIOD_7D,
          source: "mart_ad_performance_daily",
          asOf,
        },
        {
          metricKey: "roas_7d",
          value: adSpend > 0 ? attributedRevenue / adSpend : 0,
          period: METRIC_SNAPSHOT_PERIOD_7D,
          source: "mart_ad_performance_daily",
          asOf,
        },
        {
          metricKey: "mer_7d",
          value: mer,
          period: METRIC_SNAPSHOT_PERIOD_7D,
          source: "mart_ad_performance_daily",
          asOf,
        },
      ];

      for (const snapshot of snapshots) {
        await upsertSnapshot(db, storeId, snapshot);
      }
    } else {
      await upsertSnapshot(db, storeId, {
        metricKey: "mer_30d",
        value: mer,
        period: METRIC_SNAPSHOT_PERIOD_30D,
        source: "mart_ad_performance_daily",
        asOf,
      });
    }
  }

  const leakRows = await db
    .select({
      amount: profitLeaks.amountAtRiskUsd,
    })
    .from(profitLeaks)
    .where(and(eq(profitLeaks.storeId, storeId), eq(profitLeaks.status, "active")));

  const profitAtRisk = leakRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

  await upsertSnapshot(db, storeId, {
    metricKey: "active_profit_leaks",
    value: leakRows.length,
    period: METRIC_SNAPSHOT_PERIOD_7D,
    source: "profit_leaks",
    asOf,
  });
  await upsertSnapshot(db, storeId, {
    metricKey: "profit_at_risk_usd",
    value: profitAtRisk,
    period: METRIC_SNAPSHOT_PERIOD_7D,
    source: "profit_leaks",
    asOf,
  });
}

export async function refreshProfitLeakSnapshots(db: Database, storeId: string): Promise<void> {
  const asOf = new Date();
  const leakRows = await db
    .select({
      amount: profitLeaks.amountAtRiskUsd,
    })
    .from(profitLeaks)
    .where(and(eq(profitLeaks.storeId, storeId), eq(profitLeaks.status, "active")));

  const profitAtRisk = leakRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

  await upsertSnapshot(db, storeId, {
    metricKey: "active_profit_leaks",
    value: leakRows.length,
    period: METRIC_SNAPSHOT_PERIOD_7D,
    source: "profit_leaks",
    asOf,
  });
  await upsertSnapshot(db, storeId, {
    metricKey: "profit_at_risk_usd",
    value: profitAtRisk,
    period: METRIC_SNAPSHOT_PERIOD_7D,
    source: "profit_leaks",
    asOf,
  });
}

export async function refreshMetricSnapshotsForStore(
  db: Database,
  storeId: string,
  referenceDay = new Date().toISOString().slice(0, 10),
): Promise<{ store_id: string; metrics_written: number }> {
  const agent = await getSqlAgentService();
  const googleAdsConnected = await isGoogleAdsConnected(db, storeId);

  if (agent) {
    await refreshFromClickHouse(db, storeId, agent, referenceDay, googleAdsConnected);
  } else {
    await refreshFromPostgres(db, storeId, referenceDay, googleAdsConnected);
  }

  await refreshProfitLeakSnapshots(db, storeId);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(metricSnapshots)
    .where(eq(metricSnapshots.storeId, storeId));

  return {
    store_id: storeId,
    metrics_written: countRow?.count ?? 0,
  };
}

export async function refreshMetricSnapshotsForAllStores(
  db: Database,
): Promise<Array<{ store_id: string; metrics_written: number }>> {
  const storeRows = await db.select({ id: stores.id }).from(stores);
  const results: Array<{ store_id: string; metrics_written: number }> = [];

  for (const store of storeRows) {
    results.push(await refreshMetricSnapshotsForStore(db, store.id));
  }

  return results;
}

export async function getStoreMetrics(db: Database, storeId: string): Promise<StoreMetricsView> {
  const rows = await db
    .select()
    .from(metricSnapshots)
    .where(eq(metricSnapshots.storeId, storeId))
    .orderBy(metricSnapshots.metricKey);

  const metrics: MetricSnapshotRow[] = rows.map((row) => ({
    metric_key: row.metricKey,
    value: row.value,
    period: row.period,
    as_of: row.asOf.toISOString(),
    source: row.source,
  }));

  const latestAsOf = rows.reduce<Date | null>((latest, row) => {
    if (!latest || row.asOf > latest) return row.asOf;
    return latest;
  }, null);

  const staleMs = METRIC_SNAPSHOT_STALE_HOURS * 60 * 60 * 1000;
  const isStale = latestAsOf ? Date.now() - latestAsOf.getTime() > staleMs : true;
  const metaConnected = await isMetaConnected(db, storeId);

  return {
    store_id: storeId,
    snapshots_as_of: latestAsOf?.toISOString() ?? null,
    is_stale: isStale,
    stale_after_hours: METRIC_SNAPSHOT_STALE_HOURS,
    meta_connected: metaConnected,
    tooltips: {
      mer: MER_TOOLTIP,
      roas: ROAS_TOOLTIP,
    },
    metrics,
  };
}

export function metricValue(metrics: MetricSnapshotRow[], key: string): number | null {
  const row = metrics.find((metric) => metric.metric_key === key);
  if (!row) return null;
  const value = Number(row.value);
  return Number.isFinite(value) ? value : null;
}
