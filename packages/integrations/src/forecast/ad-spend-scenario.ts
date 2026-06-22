import { calculatePoas, calculateRoas } from "../marketing/poas.js";
import type { ScenarioChannel } from "./scenario-intent.js";

export type ScenarioConfidence = "high" | "medium" | "low";

export type ScenarioAssumptionKey =
  | "poas_7d"
  | "roas_7d"
  | "baseline_spend_7d"
  | "confidence_band_pct";

export type ScenarioAssumptionItem = {
  key: ScenarioAssumptionKey;
  label: string;
  value: number;
  editable: boolean;
  unit?: string;
  description?: string;
};

export type AdSpendScenarioAssumptionOverrides = Partial<
  Record<ScenarioAssumptionKey, number>
> & {
  meta_poas_7d?: number;
  google_poas_7d?: number;
  meta_roas_7d?: number;
  google_roas_7d?: number;
  meta_baseline_spend_7d?: number;
  google_baseline_spend_7d?: number;
};

export type AdSpendScenarioInput = {
  channel: ScenarioChannel;
  spendChangePct: number;
  baselineSpend7dUsd: number | null;
  baselineRevenue7dUsd?: number | null;
  poas7d: number | null;
  runwayDays: number | null;
  avgDailyNetOutflow: number | null;
  referenceDay: string;
  assumptionOverrides?: AdSpendScenarioAssumptionOverrides;
};

export type AdSpendScenarioResult = {
  scenario_type: "ad_spend";
  channel: ScenarioChannel;
  spend_change_pct: number;
  baseline_spend_7d_usd: number;
  baseline_revenue_7d_usd: number | null;
  poas_7d: number | null;
  roas_7d: number | null;
  revenue_change_low_usd: number;
  revenue_change_high_usd: number;
  profit_change_low_usd: number;
  profit_change_high_usd: number;
  cash_impact_low_usd: number;
  cash_impact_high_usd: number;
  confidence: ScenarioConfidence;
  confidence_band_pct: number;
  runway_days_baseline: number | null;
  runway_days_delta_low: number | null;
  runway_days_delta_high: number | null;
  assumption_items: ScenarioAssumptionItem[];
  assumptions: string[];
};

function confidenceBand(confidence: ScenarioConfidence): number {
  switch (confidence) {
    case "high":
      return 10;
    case "medium":
      return 20;
    default:
      return 35;
  }
}

function resolveConfidence(input: AdSpendScenarioInput): ScenarioConfidence {
  if (input.baselineSpend7dUsd == null || input.baselineSpend7dUsd <= 0) return "low";
  if (input.poas7d == null) return "low";
  if (input.baselineSpend7dUsd >= 500) return "high";
  return "medium";
}

function formatChannel(channel: ScenarioChannel): string {
  return channel === "google" ? "Google" : "Meta";
}

function resolveRoas7d(
  baselineSpend: number,
  baselineRevenue: number | null | undefined,
  poas: number,
): number {
  if (baselineRevenue != null && baselineRevenue > 0 && baselineSpend > 0) {
    return baselineRevenue / baselineSpend;
  }
  return Math.max(poas, 1);
}

function buildAssumptionItems(input: {
  channel: ScenarioChannel;
  baselineSpend: number;
  poas: number;
  roas: number;
  bandPct: number;
  overrides?: AdSpendScenarioAssumptionOverrides;
}): ScenarioAssumptionItem[] {
  const channelLabel = formatChannel(input.channel);
  return [
    {
      key: "poas_7d",
      label: `${channelLabel} POAS (7d)`,
      value: input.overrides?.poas_7d ?? input.poas,
      editable: true,
      description: "Profit on ad spend held constant for the scenario window",
    },
    {
      key: "roas_7d",
      label: `${channelLabel} ROAS (7d)`,
      value: input.overrides?.roas_7d ?? input.roas,
      editable: true,
      description: "Return on ad spend used for revenue projection",
    },
    {
      key: "baseline_spend_7d",
      label: `${channelLabel} baseline spend (7d)`,
      value: input.overrides?.baseline_spend_7d ?? input.baselineSpend,
      editable: true,
      unit: "usd",
      description: "Trailing 7-day ad spend before the scenario change",
    },
    {
      key: "confidence_band_pct",
      label: "Confidence band",
      value: input.overrides?.confidence_band_pct ?? input.bandPct,
      editable: true,
      unit: "pct",
      description: "Range width applied to POAS and ROAS projections",
    },
  ];
}

function assumptionSummary(items: ScenarioAssumptionItem[], channel: ScenarioChannel): string[] {
  const channelLabel = formatChannel(channel);
  const poas = items.find((item) => item.key === "poas_7d")?.value ?? 1;
  const spend = items.find((item) => item.key === "baseline_spend_7d")?.value ?? 0;
  const band = items.find((item) => item.key === "confidence_band_pct")?.value ?? 20;

  return [
    `Assumes ${channelLabel} POAS (${poas.toFixed(2)}) holds over the next 7 days`,
    `Uses trailing 7-day ${channelLabel} spend ($${Math.round(spend).toLocaleString("en-US")}) as baseline`,
    `Confidence band ±${Math.round(band)}% on POAS and ROAS`,
    "Excludes planned inventory purchases and one-off expenses",
  ];
}

export function runAdSpendScenarioForecast(input: AdSpendScenarioInput): AdSpendScenarioResult | null {
  if (input.baselineSpend7dUsd == null || input.baselineSpend7dUsd <= 0) {
    return null;
  }

  const baselineSpend =
    input.assumptionOverrides?.baseline_spend_7d ?? input.baselineSpend7dUsd;
  const confidence = resolveConfidence(input);
  const defaultBandPct = confidenceBand(confidence);
  const bandPct = input.assumptionOverrides?.confidence_band_pct ?? defaultBandPct;
  const poas = input.assumptionOverrides?.poas_7d ?? input.poas7d ?? 1;
  const roas = input.assumptionOverrides?.roas_7d ?? resolveRoas7d(baselineSpend, input.baselineRevenue7dUsd, poas);

  const deltaSpend = baselineSpend * (input.spendChangePct / 100);
  const poasLow = poas * (1 - bandPct / 100);
  const poasHigh = poas * (1 + bandPct / 100);
  const roasLow = roas * (1 - bandPct / 100);
  const roasHigh = roas * (1 + bandPct / 100);

  const revenueLow = deltaSpend * roasLow;
  const revenueHigh = deltaSpend * roasHigh;
  const profitLow = deltaSpend * poasLow;
  const profitHigh = deltaSpend * poasHigh;
  const cashLow = deltaSpend * (poasLow - 1);
  const cashHigh = deltaSpend * (poasHigh - 1);

  const assumptionItems = buildAssumptionItems({
    channel: input.channel,
    baselineSpend,
    poas,
    roas,
    bandPct,
    overrides: input.assumptionOverrides,
  });

  let runwayDeltaLow: number | null = null;
  let runwayDeltaHigh: number | null = null;
  if (input.avgDailyNetOutflow != null && input.avgDailyNetOutflow > 0) {
    runwayDeltaLow = Math.round((cashLow / input.avgDailyNetOutflow) * 10) / 10;
    runwayDeltaHigh = Math.round((cashHigh / input.avgDailyNetOutflow) * 10) / 10;
  }

  const baselineRevenue =
    input.baselineRevenue7dUsd != null && input.baselineRevenue7dUsd > 0
      ? input.baselineRevenue7dUsd
      : baselineSpend * roas;

  return {
    scenario_type: "ad_spend",
    channel: input.channel,
    spend_change_pct: input.spendChangePct,
    baseline_spend_7d_usd: baselineSpend,
    baseline_revenue_7d_usd: Math.round(baselineRevenue),
    poas_7d: input.poas7d,
    roas_7d: Math.round(roas * 100) / 100,
    revenue_change_low_usd: Math.round(revenueLow),
    revenue_change_high_usd: Math.round(revenueHigh),
    profit_change_low_usd: Math.round(profitLow),
    profit_change_high_usd: Math.round(profitHigh),
    cash_impact_low_usd: Math.round(cashLow),
    cash_impact_high_usd: Math.round(cashHigh),
    confidence,
    confidence_band_pct: bandPct,
    runway_days_baseline: input.runwayDays,
    runway_days_delta_low: runwayDeltaLow,
    runway_days_delta_high: runwayDeltaHigh,
    assumption_items: assumptionItems,
    assumptions: assumptionSummary(assumptionItems, input.channel),
  };
}

export function aggregatePoas7d(
  rows: Array<{ ad_spend: number; attributed_contribution_margin: number }>,
): number | null {
  const spend = rows.reduce((sum, row) => sum + row.ad_spend, 0);
  const margin = rows.reduce((sum, row) => sum + row.attributed_contribution_margin, 0);
  return calculatePoas(margin, spend);
}

export function aggregateRoas7d(
  rows: Array<{ ad_spend: number; attributed_revenue: number }>,
): number | null {
  const spend = rows.reduce((sum, row) => sum + row.ad_spend, 0);
  const revenue = rows.reduce((sum, row) => sum + row.attributed_revenue, 0);
  return calculateRoas(revenue, spend);
}

export type AdSpendScenarioChannelChange = {
  channel: ScenarioChannel;
  spend_change_pct: number;
};

export type CombinedAdSpendScenarioResult = {
  reference_day: string;
  scenarios: AdSpendScenarioResult[];
  combined: {
    revenue_change_low_usd: number;
    revenue_change_high_usd: number;
    profit_change_low_usd: number;
    profit_change_high_usd: number;
    cash_impact_low_usd: number;
    cash_impact_high_usd: number;
    runway_days_baseline: number | null;
    runway_days_delta_low: number | null;
    runway_days_delta_high: number | null;
  };
};

export function combineAdSpendScenarioResults(
  scenarios: AdSpendScenarioResult[],
  referenceDay: string,
  avgDailyNetOutflow: number | null = null,
): CombinedAdSpendScenarioResult {
  const combined = scenarios.reduce(
    (acc, scenario) => ({
      revenue_change_low_usd: acc.revenue_change_low_usd + scenario.revenue_change_low_usd,
      revenue_change_high_usd: acc.revenue_change_high_usd + scenario.revenue_change_high_usd,
      profit_change_low_usd: acc.profit_change_low_usd + scenario.profit_change_low_usd,
      profit_change_high_usd: acc.profit_change_high_usd + scenario.profit_change_high_usd,
      cash_impact_low_usd: acc.cash_impact_low_usd + scenario.cash_impact_low_usd,
      cash_impact_high_usd: acc.cash_impact_high_usd + scenario.cash_impact_high_usd,
    }),
    {
      revenue_change_low_usd: 0,
      revenue_change_high_usd: 0,
      profit_change_low_usd: 0,
      profit_change_high_usd: 0,
      cash_impact_low_usd: 0,
      cash_impact_high_usd: 0,
    },
  );

  const runwayBaseline = scenarios.find((row) => row.runway_days_baseline != null)?.runway_days_baseline ?? null;

  let runwayDeltaLow: number | null = null;
  let runwayDeltaHigh: number | null = null;
  if (avgDailyNetOutflow != null && avgDailyNetOutflow > 0) {
    runwayDeltaLow = Math.round((combined.cash_impact_low_usd / avgDailyNetOutflow) * 10) / 10;
    runwayDeltaHigh = Math.round((combined.cash_impact_high_usd / avgDailyNetOutflow) * 10) / 10;
  }

  return {
    reference_day: referenceDay,
    scenarios,
    combined: {
      ...combined,
      runway_days_baseline: runwayBaseline,
      runway_days_delta_low: runwayDeltaLow,
      runway_days_delta_high: runwayDeltaHigh,
    },
  };
}
