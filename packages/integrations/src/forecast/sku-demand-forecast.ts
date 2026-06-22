import { addDaysToDayString } from "../cash/runway.js";
import {
  merchantLocalDay,
  merchantLocalHourMinute,
  parseBriefingTimeLocal,
} from "../briefing/briefing.js";

export const SKU_DEMAND_FORECAST_HORIZON_DAYS = 30;
export const SKU_DEMAND_FORECAST_TOP_N = 50;
export const SKU_DEMAND_HISTORY_LOOKBACK_DAYS = 120;
export const SKU_DEMAND_MIN_HISTORY_DAYS = 30;
export const MOVING_AVERAGE_WINDOW_DAYS = 30;
export const INTERMITTENT_ZERO_DAY_RATIO = 0.5;
export const HIGH_VELOCITY_MIN_DAILY_UNITS = 1;
export const DEFAULT_SKU_DEMAND_FORECAST_TIME_LOCAL = "06:15";

export type SkuDemandModel = "croston" | "moving_average";

export type DailySkuUnitPoint = {
  day: string;
  units: number;
};

export type SkuDemandForecastDailyPoint = {
  day: string;
  units: number;
};

export type SkuDemandForecastResult = {
  sku: string;
  model: SkuDemandModel;
  history_days: number;
  zero_day_ratio: number;
  avg_daily_units: number;
  forecast_units_total: number;
  daily: SkuDemandForecastDailyPoint[];
};

export function buildDailySkuUnitSeries(
  sales: Array<{ day: string; sku: string; units_sold: number }>,
  sku: string,
  startDay: string,
  endDay: string,
): DailySkuUnitPoint[] {
  const days: string[] = [];
  for (let cursor = startDay; cursor <= endDay; cursor = addDaysToDayString(cursor, 1)) {
    days.push(cursor);
  }

  const byDay = new Map<string, number>(days.map((day) => [day, 0]));
  for (const sale of sales) {
    if (sale.sku !== sku) continue;
    if (sale.day < startDay || sale.day > endDay) continue;
    byDay.set(sale.day, (byDay.get(sale.day) ?? 0) + sale.units_sold);
  }

  return days.map((day) => ({
    day,
    units: byDay.get(day) ?? 0,
  }));
}

export function classifySkuDemandPattern(dailyUnits: number[]): SkuDemandModel {
  if (dailyUnits.length === 0) return "croston";

  const zeroDays = dailyUnits.filter((units) => units <= 0).length;
  const zeroRatio = zeroDays / dailyUnits.length;
  const average =
    dailyUnits.reduce((sum, units) => sum + units, 0) / Math.max(dailyUnits.length, 1);

  if (zeroRatio >= INTERMITTENT_ZERO_DAY_RATIO || average < HIGH_VELOCITY_MIN_DAILY_UNITS) {
    return "croston";
  }

  return "moving_average";
}

function roundUnits(value: number): number {
  return Math.round(value * 100) / 100;
}

export function crostonDemandForecast(
  history: DailySkuUnitPoint[],
  horizonDays: number,
  asOfDay: string,
): { avg_daily_units: number; forecast_units_total: number; daily: SkuDemandForecastDailyPoint[] } {
  const dailyUnits = history.map((point) => point.units);
  const nonZeroIndexes: number[] = [];
  for (let index = 0; index < dailyUnits.length; index += 1) {
    if ((dailyUnits[index] ?? 0) > 0) {
      nonZeroIndexes.push(index);
    }
  }

  const forwardDays = buildForwardForecastDays(asOfDay, horizonDays);
  if (nonZeroIndexes.length === 0) {
    return {
      avg_daily_units: 0,
      forecast_units_total: 0,
      daily: forwardDays.map((day) => ({ day, units: 0 })),
    };
  }

  const demandSizes = nonZeroIndexes.map((index) => dailyUnits[index] ?? 0);
  const intervals: number[] = [];
  for (let index = 1; index < nonZeroIndexes.length; index += 1) {
    intervals.push(nonZeroIndexes[index]! - nonZeroIndexes[index - 1]!);
  }

  const avgDemandSize =
    demandSizes.reduce((sum, value) => sum + value, 0) / Math.max(demandSizes.length, 1);
  const avgInterval =
    intervals.length > 0
      ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length
      : Math.max(dailyUnits.length, 1);

  const forecastRate = avgDemandSize / Math.max(avgInterval, 1);
  const perDay = roundUnits(forecastRate);

  return {
    avg_daily_units: perDay,
    forecast_units_total: roundUnits(perDay * horizonDays),
    daily: forwardDays.map((day) => ({ day, units: perDay })),
  };
}

export function movingAverageDemandForecast(
  history: DailySkuUnitPoint[],
  horizonDays: number,
  asOfDay: string,
  windowDays = MOVING_AVERAGE_WINDOW_DAYS,
): { avg_daily_units: number; forecast_units_total: number; daily: SkuDemandForecastDailyPoint[] } {
  const window = history.slice(-windowDays);
  const average =
    window.length > 0
      ? window.reduce((sum, point) => sum + point.units, 0) / window.length
      : 0;
  const perDay = roundUnits(average);
  const forwardDays = buildForwardForecastDays(asOfDay, horizonDays);

  return {
    avg_daily_units: perDay,
    forecast_units_total: roundUnits(perDay * horizonDays),
    daily: forwardDays.map((day) => ({ day, units: perDay })),
  };
}

export function buildForwardForecastDays(asOfDay: string, horizonDays: number): string[] {
  const days: string[] = [];
  for (let index = 1; index <= horizonDays; index += 1) {
    days.push(addDaysToDayString(asOfDay, index));
  }
  return days;
}

export function forecastSkuDemand(input: {
  sku: string;
  history: DailySkuUnitPoint[];
  as_of_day: string;
  horizon_days?: number;
}): SkuDemandForecastResult | null {
  const horizonDays = input.horizon_days ?? SKU_DEMAND_FORECAST_HORIZON_DAYS;
  if (input.history.length < SKU_DEMAND_MIN_HISTORY_DAYS) {
    return null;
  }

  const dailyUnits = input.history.map((point) => point.units);
  const zeroDayRatio =
    dailyUnits.filter((units) => units <= 0).length / Math.max(dailyUnits.length, 1);
  const model = classifySkuDemandPattern(dailyUnits);
  const forecast =
    model === "croston"
      ? crostonDemandForecast(input.history, horizonDays, input.as_of_day)
      : movingAverageDemandForecast(input.history, horizonDays, input.as_of_day);

  return {
    sku: input.sku,
    model,
    history_days: input.history.length,
    zero_day_ratio: roundUnits(zeroDayRatio),
    avg_daily_units: forecast.avg_daily_units,
    forecast_units_total: forecast.forecast_units_total,
    daily: forecast.daily,
  };
}

export function selectTopSkusByRevenue<T extends { sku: string; gross_revenue: number }>(
  skus: T[],
  limit = SKU_DEMAND_FORECAST_TOP_N,
): T[] {
  return [...skus].sort((left, right) => right.gross_revenue - left.gross_revenue).slice(0, limit);
}

export function shouldRunSkuDemandForecast(input: {
  timezone: string;
  lastForecastDay: string | null;
  forecastTimeLocal?: string;
  at?: Date;
}): boolean {
  const at = input.at ?? new Date();
  const localDay = merchantLocalDay(input.timezone, at);
  if (input.lastForecastDay === localDay) return false;

  const { hour: targetHour, minute: targetMinute } = parseBriefingTimeLocal(
    input.forecastTimeLocal ?? DEFAULT_SKU_DEMAND_FORECAST_TIME_LOCAL,
  );
  const { hour, minute } = merchantLocalHourMinute(input.timezone, at);
  const currentMinutes = hour * 60 + minute;
  const targetMinutes = targetHour * 60 + targetMinute;

  return currentMinutes >= targetMinutes;
}
