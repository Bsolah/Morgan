import { and, desc, eq } from "drizzle-orm";
import {
  metricSnapshots,
  skuDemandForecastItems,
  skuDemandForecastPoints,
  skuDemandForecastRuns,
  stores,
  type Database,
} from "@morgan/db";
import {
  buildDailySkuUnitSeries,
  forecastSkuDemand,
  merchantLocalDay,
  merchantLocalYesterday,
  parseOrderSkuUnitSales,
  selectTopSkusByRevenue,
  shouldRunSkuDemandForecast,
  SKU_DEMAND_FORECAST_HORIZON_DAYS,
  SKU_DEMAND_FORECAST_TOP_N,
  SKU_DEMAND_HISTORY_LOOKBACK_DAYS,
  type SkuDemandForecastResult,
} from "@morgan/integrations";
import { env } from "../config.js";
import { loadStoreBriefingConfig } from "./briefing-generation-service.js";
import { parseOrderPayload, readOrderFactsForStore } from "./order-fact-reader.js";
import { getProfitSkuRanking } from "./sku-economics-service.js";

const LAST_SKU_DEMAND_FORECAST_METRIC_KEY = "last_sku_demand_forecast";
const LAST_SKU_DEMAND_FORECAST_PERIOD = "daily";

export type SkuDemandForecastItemView = {
  sku: string;
  revenue_rank: number;
  model: SkuDemandForecastResult["model"];
  history_days: number;
  zero_day_ratio: number | null;
  avg_daily_units: number;
  forecast_units_total: number;
  daily: Array<{ day: string; units: number }>;
};

export type SkuDemandForecastView = {
  store_id: string;
  status: "ready" | "insufficient_data";
  message: string | null;
  as_of_day: string | null;
  generated_at: string | null;
  horizon_days: number;
  sku_count: number;
  skus: SkuDemandForecastItemView[];
};

export type SkuDemandForecastRefreshResult = {
  store_id: string;
  refreshed: boolean;
  skipped_reason?: string;
  status: SkuDemandForecastView["status"];
  sku_count: number;
};

function addDays(isoDay: string, days: number): string {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatUnits(value: number): string {
  return value.toFixed(4);
}

async function loadSkuUnitSales(
  storeId: string,
  startDay: string,
  endDay: string,
): Promise<Array<{ day: string; sku: string; units_sold: number }>> {
  const orderRows = await readOrderFactsForStore(
    env.BRONZE_STORAGE_PATH,
    storeId,
    startDay,
    endDay,
  );

  return orderRows.flatMap((row) =>
    parseOrderSkuUnitSales(parseOrderPayload(row), row.order_id ?? row.event_id),
  );
}

async function getLastSkuDemandForecastDay(
  db: Database,
  storeId: string,
  timezone: string,
): Promise<string | null> {
  const [row] = await db
    .select({ asOf: metricSnapshots.asOf })
    .from(metricSnapshots)
    .where(
      and(
        eq(metricSnapshots.storeId, storeId),
        eq(metricSnapshots.metricKey, LAST_SKU_DEMAND_FORECAST_METRIC_KEY),
        eq(metricSnapshots.period, LAST_SKU_DEMAND_FORECAST_PERIOD),
      ),
    )
    .limit(1);

  if (!row?.asOf) return null;
  return merchantLocalDay(timezone, row.asOf);
}

async function recordSkuDemandForecastComplete(db: Database, storeId: string, at: Date): Promise<void> {
  await db
    .insert(metricSnapshots)
    .values({
      storeId,
      metricKey: LAST_SKU_DEMAND_FORECAST_METRIC_KEY,
      value: "1",
      period: LAST_SKU_DEMAND_FORECAST_PERIOD,
      asOf: at,
      source: "sku_demand_forecast",
    })
    .onConflictDoUpdate({
      target: [metricSnapshots.storeId, metricSnapshots.metricKey, metricSnapshots.period],
      set: {
        value: "1",
        asOf: at,
        source: "sku_demand_forecast",
        updatedAt: new Date(),
      },
    });
}

async function persistSkuDemandForecastRun(
  db: Database,
  storeId: string,
  asOfDay: string,
  horizonDays: number,
  forecasts: SkuDemandForecastResult[],
): Promise<void> {
  const [existing] = await db
    .select({ id: skuDemandForecastRuns.id })
    .from(skuDemandForecastRuns)
    .where(eq(skuDemandForecastRuns.storeId, storeId))
    .limit(1);

  if (existing) {
    await db.delete(skuDemandForecastPoints).where(eq(skuDemandForecastPoints.runId, existing.id));
    await db.delete(skuDemandForecastItems).where(eq(skuDemandForecastItems.runId, existing.id));
    await db.delete(skuDemandForecastRuns).where(eq(skuDemandForecastRuns.id, existing.id));
  }

  const [run] = await db
    .insert(skuDemandForecastRuns)
    .values({
      storeId,
      asOfDay,
      horizonDays,
      skuCount: forecasts.length,
      status: forecasts.length > 0 ? "ready" : "insufficient_data",
      message: forecasts.length > 0 ? null : "No SKUs had enough history for demand forecasting.",
      generatedAt: new Date(),
    })
    .returning();

  if (!run || forecasts.length === 0) return;

  await db.insert(skuDemandForecastItems).values(
    forecasts.map((forecast, index) => ({
      runId: run.id,
      sku: forecast.sku,
      revenueRank: index + 1,
      model: forecast.model,
      historyDays: forecast.history_days,
      zeroDayRatio: formatUnits(forecast.zero_day_ratio),
      avgDailyUnits: formatUnits(forecast.avg_daily_units),
      forecastUnitsTotal: formatUnits(forecast.forecast_units_total),
    })),
  );

  const pointRows = forecasts.flatMap((forecast) =>
    forecast.daily.map((point) => ({
      runId: run.id,
      sku: forecast.sku,
      forecastDay: point.day,
      units: formatUnits(point.units),
    })),
  );

  if (pointRows.length > 0) {
    await db.insert(skuDemandForecastPoints).values(pointRows);
  }
}

export async function refreshSkuDemandForecastForStore(
  db: Database,
  storeId: string,
  options: { force?: boolean; horizonDays?: number } = {},
): Promise<SkuDemandForecastRefreshResult> {
  const config = await loadStoreBriefingConfig(db, storeId);
  const timezone = config?.timezone ?? "UTC";
  const referenceDay = merchantLocalYesterday(timezone);
  const horizonDays = options.horizonDays ?? SKU_DEMAND_FORECAST_HORIZON_DAYS;

  if (!options.force) {
    const lastForecastDay = await getLastSkuDemandForecastDay(db, storeId, timezone);
    if (
      !shouldRunSkuDemandForecast({
        timezone,
        lastForecastDay,
        forecastTimeLocal: env.SKU_DEMAND_FORECAST_TIME_LOCAL,
      })
    ) {
      return {
        store_id: storeId,
        refreshed: false,
        skipped_reason: "not_due",
        status: "insufficient_data",
        sku_count: 0,
      };
    }
  }

  const ranking = await getProfitSkuRanking(db, storeId, 30);
  const topSkus = selectTopSkusByRevenue(
    ranking.skus.map((sku) => ({ sku: sku.sku, gross_revenue: sku.gross_revenue })),
    SKU_DEMAND_FORECAST_TOP_N,
  );

  const historyStartDay = addDays(referenceDay, -(SKU_DEMAND_HISTORY_LOOKBACK_DAYS - 1));
  const sales = await loadSkuUnitSales(storeId, historyStartDay, referenceDay);

  const forecasts: SkuDemandForecastResult[] = [];
  for (const sku of topSkus) {
    const history = buildDailySkuUnitSeries(sales, sku.sku, historyStartDay, referenceDay);
    const forecast = forecastSkuDemand({
      sku: sku.sku,
      history,
      as_of_day: referenceDay,
      horizon_days: horizonDays,
    });
    if (forecast) {
      forecasts.push(forecast);
    }
  }

  await persistSkuDemandForecastRun(db, storeId, referenceDay, horizonDays, forecasts);
  await recordSkuDemandForecastComplete(db, storeId, new Date());

  return {
    store_id: storeId,
    refreshed: true,
    status: forecasts.length > 0 ? "ready" : "insufficient_data",
    sku_count: forecasts.length,
  };
}

export async function refreshDueSkuDemandForecasts(
  db: Database,
  options: { force?: boolean } = {},
): Promise<SkuDemandForecastRefreshResult[]> {
  const storeRows = await db.select({ id: stores.id }).from(stores);
  const results: SkuDemandForecastRefreshResult[] = [];

  for (const store of storeRows) {
    const result = await refreshSkuDemandForecastForStore(db, store.id, options);
    if (result.refreshed) {
      results.push(result);
    }
  }

  return results;
}

export async function getSkuDemandForecastMap(
  db: Database,
  storeId: string,
): Promise<Map<string, SkuDemandForecastResult>> {
  try {
    const [run] = await db
      .select()
      .from(skuDemandForecastRuns)
      .where(eq(skuDemandForecastRuns.storeId, storeId))
      .orderBy(desc(skuDemandForecastRuns.generatedAt))
      .limit(1);

    if (!run || run.status !== "ready") {
      return new Map();
    }

    const [items, points] = await Promise.all([
      db
        .select()
        .from(skuDemandForecastItems)
        .where(eq(skuDemandForecastItems.runId, run.id)),
      db
        .select()
        .from(skuDemandForecastPoints)
        .where(eq(skuDemandForecastPoints.runId, run.id))
        .orderBy(skuDemandForecastPoints.forecastDay),
    ]);

    const dailyBySku = new Map<string, Array<{ day: string; units: number }>>();
    for (const point of points) {
      const rows = dailyBySku.get(point.sku) ?? [];
      rows.push({ day: point.forecastDay, units: Number(point.units) });
      dailyBySku.set(point.sku, rows);
    }

    const forecasts = new Map<string, SkuDemandForecastResult>();
    for (const item of items) {
      forecasts.set(item.sku, {
        sku: item.sku,
        model: item.model as SkuDemandForecastResult["model"],
        history_days: item.historyDays,
        zero_day_ratio: item.zeroDayRatio != null ? Number(item.zeroDayRatio) : 0,
        avg_daily_units: Number(item.avgDailyUnits),
        forecast_units_total: Number(item.forecastUnitsTotal),
        daily: dailyBySku.get(item.sku) ?? [],
      });
    }

    return forecasts;
  } catch {
    return new Map();
  }
}

export async function getSkuDemandForecast(
  db: Database,
  storeId: string,
): Promise<SkuDemandForecastView> {
  const [run] = await db
    .select()
    .from(skuDemandForecastRuns)
    .where(eq(skuDemandForecastRuns.storeId, storeId))
    .orderBy(desc(skuDemandForecastRuns.generatedAt))
    .limit(1);

  if (!run) {
    return {
      store_id: storeId,
      status: "insufficient_data",
      message: "SKU demand forecast has not been generated yet.",
      as_of_day: null,
      generated_at: null,
      horizon_days: SKU_DEMAND_FORECAST_HORIZON_DAYS,
      sku_count: 0,
      skus: [],
    };
  }

  if (run.status !== "ready") {
    return {
      store_id: storeId,
      status: "insufficient_data",
      message: run.message,
      as_of_day: run.asOfDay,
      generated_at: run.generatedAt.toISOString(),
      horizon_days: run.horizonDays,
      sku_count: run.skuCount,
      skus: [],
    };
  }

  const [items, points] = await Promise.all([
    db
      .select()
      .from(skuDemandForecastItems)
      .where(eq(skuDemandForecastItems.runId, run.id))
      .orderBy(skuDemandForecastItems.revenueRank),
    db
      .select()
      .from(skuDemandForecastPoints)
      .where(eq(skuDemandForecastPoints.runId, run.id))
      .orderBy(skuDemandForecastPoints.forecastDay),
  ]);

  const dailyBySku = new Map<string, Array<{ day: string; units: number }>>();
  for (const point of points) {
    const rows = dailyBySku.get(point.sku) ?? [];
    rows.push({ day: point.forecastDay, units: Number(point.units) });
    dailyBySku.set(point.sku, rows);
  }

  return {
    store_id: storeId,
    status: "ready",
    message: null,
    as_of_day: run.asOfDay,
    generated_at: run.generatedAt.toISOString(),
    horizon_days: run.horizonDays,
    sku_count: run.skuCount,
    skus: items.map((item) => ({
      sku: item.sku,
      revenue_rank: item.revenueRank,
      model: item.model as SkuDemandForecastResult["model"],
      history_days: item.historyDays,
      zero_day_ratio: item.zeroDayRatio != null ? Number(item.zeroDayRatio) : null,
      avg_daily_units: Number(item.avgDailyUnits),
      forecast_units_total: Number(item.forecastUnitsTotal),
      daily: dailyBySku.get(item.sku) ?? [],
    })),
  };
}
