import { calculatePoas } from "../marketing/poas.js";
import type { ScenarioChannel } from "./scenario-intent.js";

export type ScenarioConfidence = "high" | "medium" | "low";

export type AdSpendScenarioInput = {
  channel: ScenarioChannel;
  spendChangePct: number;
  baselineSpend7dUsd: number | null;
  poas7d: number | null;
  runwayDays: number | null;
  avgDailyNetOutflow: number | null;
  referenceDay: string;
};

export type AdSpendScenarioResult = {
  scenario_type: "ad_spend";
  channel: ScenarioChannel;
  spend_change_pct: number;
  baseline_spend_7d_usd: number;
  poas_7d: number | null;
  profit_change_low_usd: number;
  profit_change_high_usd: number;
  cash_impact_low_usd: number;
  cash_impact_high_usd: number;
  confidence: ScenarioConfidence;
  confidence_band_pct: number;
  runway_days_baseline: number | null;
  runway_days_delta_low: number | null;
  runway_days_delta_high: number | null;
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

export function runAdSpendScenarioForecast(input: AdSpendScenarioInput): AdSpendScenarioResult | null {
  if (input.baselineSpend7dUsd == null || input.baselineSpend7dUsd <= 0) {
    return null;
  }

  const baselineSpend = input.baselineSpend7dUsd;
  const deltaSpend = baselineSpend * (input.spendChangePct / 100);
  const poas = input.poas7d ?? 1;
  const confidence = resolveConfidence(input);
  const bandPct = confidenceBand(confidence);
  const poasLow = poas * (1 - bandPct / 100);
  const poasHigh = poas * (1 + bandPct / 100);

  const profitLow = deltaSpend * poasLow;
  const profitHigh = deltaSpend * poasHigh;
  const cashLow = deltaSpend * (poasLow - 1);
  const cashHigh = deltaSpend * (poasHigh - 1);

  const assumptions = [
    input.poas7d != null
      ? `Assumes current POAS (${poas.toFixed(2)}) holds`
      : "Assumes POAS of 1.0 (no margin data yet)",
    `Assumes 7-day trailing ${formatChannel(input.channel)} spend ($${Math.round(baselineSpend).toLocaleString("en-US")}) as baseline`,
    "Excludes planned inventory purchases and one-off expenses",
  ];

  let runwayDeltaLow: number | null = null;
  let runwayDeltaHigh: number | null = null;
  if (input.avgDailyNetOutflow != null && input.avgDailyNetOutflow > 0) {
    runwayDeltaLow = Math.round((cashLow / input.avgDailyNetOutflow) * 10) / 10;
    runwayDeltaHigh = Math.round((cashHigh / input.avgDailyNetOutflow) * 10) / 10;
  }

  return {
    scenario_type: "ad_spend",
    channel: input.channel,
    spend_change_pct: input.spendChangePct,
    baseline_spend_7d_usd: baselineSpend,
    poas_7d: input.poas7d,
    profit_change_low_usd: Math.round(profitLow),
    profit_change_high_usd: Math.round(profitHigh),
    cash_impact_low_usd: Math.round(cashLow),
    cash_impact_high_usd: Math.round(cashHigh),
    confidence,
    confidence_band_pct: bandPct,
    runway_days_baseline: input.runwayDays,
    runway_days_delta_low: runwayDeltaLow,
    runway_days_delta_high: runwayDeltaHigh,
    assumptions,
  };
}

export function aggregatePoas7d(
  rows: Array<{ ad_spend: number; attributed_contribution_margin: number }>,
): number | null {
  const spend = rows.reduce((sum, row) => sum + row.ad_spend, 0);
  const margin = rows.reduce((sum, row) => sum + row.attributed_contribution_margin, 0);
  return calculatePoas(margin, spend);
}
