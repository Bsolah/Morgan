import {
  merchantLocalDay,
  merchantLocalHourMinute,
  parseBriefingTimeLocal,
} from "../briefing/briefing.js";

export const REVENUE_FORECAST_HORIZON_DAYS = 30;
export const REVENUE_FORECAST_MIN_HISTORY_DAYS = 60;
export const REVENUE_FORECAST_TRAIN_MIN_DAYS = 90;
export const REVENUE_FORECAST_MAPE_DISPLAY_THRESHOLD = 0.25;
export const DEFAULT_REVENUE_FORECAST_TIME_LOCAL = "06:00";

export type DailyRevenuePoint = {
  day: string;
  net_revenue: number;
};

export type RevenueForecastDailyPoint = {
  day: string;
  p10: number;
  p50: number;
  p90: number;
};

export type RevenueForecastCumulativePoint = {
  day: string;
  p10: number;
  p50: number;
  p90: number;
};

export type RevenueForecastModelResult = {
  status: "ready" | "insufficient_data";
  message: string | null;
  history_days: number;
  mape: number | null;
  model: "prophet" | "exponential_smoothing";
  daily: RevenueForecastDailyPoint[];
  cumulative: RevenueForecastCumulativePoint[];
};

export function computeMape(actual: number[], predicted: number[]): number | null {
  if (actual.length === 0 || actual.length !== predicted.length) return null;

  let sum = 0;
  let count = 0;

  for (let i = 0; i < actual.length; i += 1) {
    const truth = actual[i] ?? 0;
    const forecast = predicted[i] ?? 0;
    if (truth <= 0) continue;
    sum += Math.abs((truth - forecast) / truth);
    count += 1;
  }

  if (count === 0) return null;
  return sum / count;
}

export function buildCumulativeForecast(
  daily: RevenueForecastDailyPoint[],
): RevenueForecastCumulativePoint[] {
  let cumulativeP10 = 0;
  let cumulativeP50 = 0;
  let cumulativeP90 = 0;

  return daily.map((point) => {
    cumulativeP10 += point.p10;
    cumulativeP50 += point.p50;
    cumulativeP90 += point.p90;
    return {
      day: point.day,
      p10: Math.round(cumulativeP10),
      p50: Math.round(cumulativeP50),
      p90: Math.round(cumulativeP90),
    };
  });
}

export function shouldDisplayForecastBands(mape: number | null): boolean {
  return mape != null && Number.isFinite(mape) && mape < REVENUE_FORECAST_MAPE_DISPLAY_THRESHOLD;
}

export function insufficientDataMessage(historyDays: number): string {
  if (historyDays < REVENUE_FORECAST_MIN_HISTORY_DAYS) {
    return "Insufficient data — need at least 60 days of sales history.";
  }
  return `Insufficient data — need at least ${REVENUE_FORECAST_TRAIN_MIN_DAYS} days of sales history to train the forecast.`;
}

export function shouldRunRevenueForecast(input: {
  timezone: string;
  lastForecastDay: string | null;
  forecastTimeLocal?: string;
  at?: Date;
}): boolean {
  const at = input.at ?? new Date();
  const localDay = merchantLocalDay(input.timezone, at);
  if (input.lastForecastDay === localDay) return false;

  const { hour: targetHour, minute: targetMinute } = parseBriefingTimeLocal(
    input.forecastTimeLocal ?? DEFAULT_REVENUE_FORECAST_TIME_LOCAL,
  );
  const { hour, minute } = merchantLocalHourMinute(input.timezone, at);
  const currentMinutes = hour * 60 + minute;
  const targetMinutes = targetHour * 60 + targetMinute;

  return currentMinutes >= targetMinutes;
}

function addDays(isoDay: string, days: number): string {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Exponential-smoothing fallback when Prophet service is unavailable (dev/tests). */
export function runExponentialSmoothingRevenueForecast(
  history: DailyRevenuePoint[],
  horizonDays = REVENUE_FORECAST_HORIZON_DAYS,
  referenceDay?: string,
): RevenueForecastModelResult {
  const sorted = [...history].sort((a, b) => a.day.localeCompare(b.day));
  const historyDays = sorted.length;

  if (historyDays < REVENUE_FORECAST_MIN_HISTORY_DAYS) {
    return {
      status: "insufficient_data",
      message: insufficientDataMessage(historyDays),
      history_days: historyDays,
      mape: null,
      model: "exponential_smoothing",
      daily: [],
      cumulative: [],
    };
  }

  if (historyDays < REVENUE_FORECAST_TRAIN_MIN_DAYS) {
    return {
      status: "insufficient_data",
      message: insufficientDataMessage(historyDays),
      history_days: historyDays,
      mape: null,
      model: "exponential_smoothing",
      daily: [],
      cumulative: [],
    };
  }

  const values = sorted.map((row) => row.net_revenue);
  const alpha = 0.35;
  let level = values[0] ?? 0;
  const fitted: number[] = [level];

  for (let i = 1; i < values.length; i += 1) {
    level = alpha * (values[i] ?? 0) + (1 - alpha) * level;
    fitted.push(level);
  }

  const holdout = Math.min(14, Math.floor(values.length * 0.15));
  const mape =
    holdout > 0
      ? computeMape(values.slice(-holdout), fitted.slice(-holdout))
      : computeMape(values, fitted);

  const residuals = values.map((value, index) => value - (fitted[index] ?? 0));
  const residualStd = Math.sqrt(
    residuals.reduce((sum, value) => sum + value * value, 0) / Math.max(1, residuals.length),
  );
  const band = residualStd * 1.28;

  const lastDay = referenceDay ?? sorted.at(-1)?.day ?? new Date().toISOString().slice(0, 10);
  const daily: RevenueForecastDailyPoint[] = [];

  for (let i = 1; i <= horizonDays; i += 1) {
    const p50 = Math.max(0, Math.round(level));
    daily.push({
      day: addDays(lastDay, i),
      p10: Math.max(0, Math.round(p50 - band)),
      p50,
      p90: Math.max(0, Math.round(p50 + band)),
    });
  }

  return {
    status: "ready",
    message: null,
    history_days: historyDays,
    mape,
    model: "exponential_smoothing",
    daily,
    cumulative: buildCumulativeForecast(daily),
  };
}
