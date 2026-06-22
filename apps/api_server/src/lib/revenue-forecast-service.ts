import { and, desc, eq } from "drizzle-orm";
import {
  metricSnapshots,
  revenueForecastPoints,
  revenueForecastRuns,
  stores,
  type Database,
} from "@morgan/db";
import {
  merchantLocalDay,
  merchantLocalYesterday,
  REVENUE_FORECAST_HORIZON_DAYS,
  runExponentialSmoothingRevenueForecast,
  shouldDisplayForecastBands,
  shouldRunRevenueForecast,
  type DailyRevenuePoint,
  type RevenueForecastModelResult,
} from "@morgan/integrations";
import { env } from "../config.js";
import { loadStoreBriefingConfig } from "./briefing-generation-service.js";
import { getSqlAgentService } from "./sql-agent-service.js";

const LAST_REVENUE_FORECAST_METRIC_KEY = "last_revenue_forecast";
const LAST_REVENUE_FORECAST_PERIOD = "daily";
const HISTORY_LOOKBACK_DAYS = 120;

export type RevenueForecastDailyView = {
  day: string;
  p10: number | null;
  p50: number;
  p90: number | null;
};

export type RevenueForecastCumulativeView = {
  day: string;
  p10: number | null;
  p50: number;
  p90: number | null;
};

export type RevenueForecastView = {
  store_id: string;
  status: "ready" | "insufficient_data";
  message: string | null;
  as_of_day: string | null;
  generated_at: string | null;
  history_days: number;
  horizon_days: number;
  mape: number | null;
  display_bands: boolean;
  model: string | null;
  daily: RevenueForecastDailyView[];
  cumulative: RevenueForecastCumulativeView[];
};

export type RevenueForecastRefreshResult = {
  store_id: string;
  refreshed: boolean;
  skipped_reason?: string;
  status: RevenueForecastView["status"];
  history_days: number;
  mape: number | null;
};

function addDays(isoDay: string, days: number): string {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatMoney(value: number): string {
  return value.toFixed(4);
}

function toViewBands<T extends { p10: number; p50: number; p90: number }>(
  rows: T[],
  displayBands: boolean,
): Array<{ day: string; p10: number | null; p50: number; p90: number | null }> {
  return rows.map((row) => ({
    day: row.day,
    p10: displayBands ? row.p10 : null,
    p50: row.p50,
    p90: displayBands ? row.p90 : null,
  }));
}

async function fetchDailyRevenueHistory(
  storeId: string,
  referenceDay: string,
): Promise<DailyRevenuePoint[]> {
  const agent = await getSqlAgentService();
  if (!agent) return [];

  const startDate = addDays(referenceDay, -(HISTORY_LOOKBACK_DAYS - 1));
  const result = await agent.runStandardMetricQuery("orders_daily", {
    store_id: storeId,
    start_date: startDate,
    end_date: referenceDay,
  });

  return result.rows
    .map((row) => {
      const day = String(row.day ?? "");
      if (!day) return null;
      return {
        day,
        net_revenue: Number(row.net_revenue ?? 0),
      };
    })
    .filter((row): row is DailyRevenuePoint => row != null)
    .sort((left, right) => left.day.localeCompare(right.day));
}

async function callProphetForecastService(
  history: DailyRevenuePoint[],
  horizonDays: number,
): Promise<RevenueForecastModelResult | null> {
  if (!env.FORECAST_SERVICE_URL) return null;

  const response = await fetch(`${env.FORECAST_SERVICE_URL.replace(/\/$/, "")}/forecast/revenue`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      history,
      horizon_days: horizonDays,
    }),
    signal: AbortSignal.timeout(env.FORECAST_SERVICE_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Forecast service returned ${response.status}`);
  }

  return (await response.json()) as RevenueForecastModelResult;
}

async function runRevenueForecastModel(
  history: DailyRevenuePoint[],
  horizonDays: number,
  referenceDay: string,
): Promise<RevenueForecastModelResult> {
  try {
    const prophetResult = await callProphetForecastService(history, horizonDays);
    if (prophetResult) return prophetResult;
  } catch {
    // Fall back to exponential smoothing when Prophet service is unavailable.
  }

  return runExponentialSmoothingRevenueForecast(history, horizonDays, referenceDay);
}

export async function getLastRevenueForecastDay(
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
        eq(metricSnapshots.metricKey, LAST_REVENUE_FORECAST_METRIC_KEY),
        eq(metricSnapshots.period, LAST_REVENUE_FORECAST_PERIOD),
      ),
    )
    .limit(1);

  if (!row?.asOf) return null;
  return merchantLocalDay(timezone, row.asOf);
}

async function recordRevenueForecastComplete(db: Database, storeId: string, at: Date): Promise<void> {
  await db
    .insert(metricSnapshots)
    .values({
      storeId,
      metricKey: LAST_REVENUE_FORECAST_METRIC_KEY,
      value: "1",
      period: LAST_REVENUE_FORECAST_PERIOD,
      asOf: at,
      source: "revenue_forecast",
    })
    .onConflictDoUpdate({
      target: [metricSnapshots.storeId, metricSnapshots.metricKey, metricSnapshots.period],
      set: {
        value: "1",
        asOf: at,
        source: "revenue_forecast",
        updatedAt: new Date(),
      },
    });
}

async function persistForecastRun(
  db: Database,
  storeId: string,
  asOfDay: string,
  horizonDays: number,
  result: RevenueForecastModelResult,
): Promise<void> {
  const [existing] = await db
    .select({ id: revenueForecastRuns.id })
    .from(revenueForecastRuns)
    .where(eq(revenueForecastRuns.storeId, storeId))
    .limit(1);

  if (existing) {
    await db.delete(revenueForecastPoints).where(eq(revenueForecastPoints.runId, existing.id));
    await db.delete(revenueForecastRuns).where(eq(revenueForecastRuns.id, existing.id));
  }

  const [run] = await db
    .insert(revenueForecastRuns)
    .values({
      storeId,
      asOfDay,
      horizonDays,
      historyDays: result.history_days,
      mape: result.mape != null ? formatMoney(result.mape) : null,
      model: result.model,
      status: result.status,
      message: result.message,
      generatedAt: new Date(),
    })
    .returning();

  if (!run || result.status !== "ready") return;

  if (result.daily.length > 0) {
    await db.insert(revenueForecastPoints).values(
      result.daily.map((point, index) => ({
        runId: run.id,
        forecastDay: point.day,
        p10: formatMoney(point.p10),
        p50: formatMoney(point.p50),
        p90: formatMoney(point.p90),
        cumulativeP10: formatMoney(result.cumulative[index]?.p10 ?? point.p10),
        cumulativeP50: formatMoney(result.cumulative[index]?.p50 ?? point.p50),
        cumulativeP90: formatMoney(result.cumulative[index]?.p90 ?? point.p90),
      })),
    );
  }
}

export async function refreshRevenueForecastForStore(
  db: Database,
  storeId: string,
  options: { force?: boolean; horizonDays?: number } = {},
): Promise<RevenueForecastRefreshResult> {
  const config = await loadStoreBriefingConfig(db, storeId);
  const timezone = config?.timezone ?? "UTC";
  const referenceDay = merchantLocalYesterday(timezone);
  const horizonDays = options.horizonDays ?? REVENUE_FORECAST_HORIZON_DAYS;

  if (!options.force) {
    const lastForecastDay = await getLastRevenueForecastDay(db, storeId, timezone);
    if (
      !shouldRunRevenueForecast({
        timezone,
        lastForecastDay,
        forecastTimeLocal: env.REVENUE_FORECAST_TIME_LOCAL,
      })
    ) {
      return {
        store_id: storeId,
        refreshed: false,
        skipped_reason: "not_due",
        status: "insufficient_data",
        history_days: 0,
        mape: null,
      };
    }
  }

  const history = await fetchDailyRevenueHistory(storeId, referenceDay);
  const result = await runRevenueForecastModel(history, horizonDays, referenceDay);
  await persistForecastRun(db, storeId, referenceDay, horizonDays, result);
  await recordRevenueForecastComplete(db, storeId, new Date());

  return {
    store_id: storeId,
    refreshed: true,
    status: result.status,
    history_days: result.history_days,
    mape: result.mape,
  };
}

export async function refreshDueRevenueForecasts(
  db: Database,
  options: { force?: boolean } = {},
): Promise<RevenueForecastRefreshResult[]> {
  const storeRows = await db.select({ id: stores.id }).from(stores);
  const results: RevenueForecastRefreshResult[] = [];

  for (const store of storeRows) {
    const result = await refreshRevenueForecastForStore(db, store.id, options);
    if (result.refreshed) {
      results.push(result);
    }
  }

  return results;
}

export async function getRevenueForecast(
  db: Database,
  storeId: string,
): Promise<RevenueForecastView> {
  const [run] = await db
    .select()
    .from(revenueForecastRuns)
    .where(eq(revenueForecastRuns.storeId, storeId))
    .orderBy(desc(revenueForecastRuns.generatedAt))
    .limit(1);

  if (!run) {
    return {
      store_id: storeId,
      status: "insufficient_data",
      message: "Forecast has not been generated yet.",
      as_of_day: null,
      generated_at: null,
      history_days: 0,
      horizon_days: REVENUE_FORECAST_HORIZON_DAYS,
      mape: null,
      display_bands: false,
      model: null,
      daily: [],
      cumulative: [],
    };
  }

  const mape = run.mape != null ? Number(run.mape) : null;
  const displayBands = shouldDisplayForecastBands(mape);

  if (run.status !== "ready") {
    return {
      store_id: storeId,
      status: "insufficient_data",
      message: run.message,
      as_of_day: run.asOfDay,
      generated_at: run.generatedAt.toISOString(),
      history_days: run.historyDays,
      horizon_days: run.horizonDays,
      mape,
      display_bands: false,
      model: run.model,
      daily: [],
      cumulative: [],
    };
  }

  const points = await db
    .select()
    .from(revenueForecastPoints)
    .where(eq(revenueForecastPoints.runId, run.id))
    .orderBy(revenueForecastPoints.forecastDay);

  const daily = points.map((point) => ({
    day: point.forecastDay,
    p10: Number(point.p10),
    p50: Number(point.p50),
    p90: Number(point.p90),
  }));
  const cumulative = points.map((point) => ({
    day: point.forecastDay,
    p10: Number(point.cumulativeP10),
    p50: Number(point.cumulativeP50),
    p90: Number(point.cumulativeP90),
  }));

  return {
    store_id: storeId,
    status: "ready",
    message: null,
    as_of_day: run.asOfDay,
    generated_at: run.generatedAt.toISOString(),
    history_days: run.historyDays,
    horizon_days: run.horizonDays,
    mape,
    display_bands: displayBands,
    model: run.model,
    daily: toViewBands(daily, displayBands),
    cumulative: toViewBands(cumulative, displayBands),
  };
}
