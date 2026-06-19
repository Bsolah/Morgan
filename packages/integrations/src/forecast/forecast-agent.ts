import type { ChatCitation, ChatDataContext, ChatSynthesisResult } from "../chat/chat-synthesis.js";
import type { ChatScenarioCard, ChatSynthesisWithScenario } from "../chat/chat-scenario-card.js";
import { runAdSpendScenarioForecast } from "./ad-spend-scenario.js";
import { parseScenarioIntent } from "./scenario-intent.js";

function formatCurrency(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString("en-US")}`;
}

function formatRange(low: number, high: number): string {
  if (Math.round(low) === Math.round(high)) return formatCurrency(low);
  const orderedLow = Math.min(low, high);
  const orderedHigh = Math.max(low, high);
  return `${formatCurrency(orderedLow)} to ${formatCurrency(orderedHigh)}`;
}

function channelLabel(channel: "meta" | "google"): string {
  return channel === "google" ? "Google" : "Meta";
}

function buildScenarioTitle(channel: "meta" | "google", spendChangePct: number): string {
  const direction = spendChangePct >= 0 ? "increase" : "decrease";
  return `${channelLabel(channel)} spend ${direction} ${Math.abs(spendChangePct)}%`;
}

function buildScenarioAnswer(
  forecast: NonNullable<ReturnType<typeof runAdSpendScenarioForecast>>,
): string {
  const direction = forecast.spend_change_pct >= 0 ? "increase" : "decrease";
  const profitRange = formatRange(forecast.profit_change_low_usd, forecast.profit_change_high_usd);
  const cashRange = formatRange(forecast.cash_impact_low_usd, forecast.cash_impact_high_usd);

  const lines = [
    `If you ${direction} ${channelLabel(forecast.channel)} spend by ${Math.abs(forecast.spend_change_pct)}% over the next 7 days, projected contribution profit could change by ${profitRange} (${forecast.confidence} confidence, ±${forecast.confidence_band_pct}% band).`,
    `Estimated cash impact over the same window: ${cashRange}.`,
  ];

  if (forecast.runway_days_delta_low != null && forecast.runway_days_delta_high != null) {
    const runwayLow = Math.min(forecast.runway_days_delta_low, forecast.runway_days_delta_high);
    const runwayHigh = Math.max(forecast.runway_days_delta_low, forecast.runway_days_delta_high);
    if (Math.round(runwayLow * 10) === Math.round(runwayHigh * 10)) {
      lines.push(`Runway may shift by about ${runwayLow.toFixed(1)} days.`);
    } else {
      lines.push(`Runway may shift by ${runwayLow.toFixed(1)} to ${runwayHigh.toFixed(1)} days.`);
    }
  }

  lines.push("", "Assumptions:", ...forecast.assumptions.map((item) => `- ${item}`));

  return lines.join("\n");
}

function buildScenarioCitations(
  context: ChatDataContext,
  forecast: NonNullable<ReturnType<typeof runAdSpendScenarioForecast>>,
): ChatCitation[] {
  return [
    {
      source_table: "mart_ad_performance",
      source_date: context.referenceDay,
      metric: "scenario_forecast",
    },
    ...(context.runwayDays != null
      ? [{ source_table: "mart_cash_daily", source_date: context.referenceDay, metric: "runway_days" }]
      : []),
  ];
}

function enrichCitationRawValues(
  context: ChatDataContext,
  forecast: NonNullable<ReturnType<typeof runAdSpendScenarioForecast>>,
): Record<string, unknown> {
  return {
    as_of_day: context.referenceDay,
    baseline_spend_7d: forecast.baseline_spend_7d_usd,
    poas_7d: forecast.poas_7d,
    spend_change_pct: forecast.spend_change_pct,
    profit_change_low: forecast.profit_change_low_usd,
    profit_change_high: forecast.profit_change_high_usd,
    cash_impact_low: forecast.cash_impact_low_usd,
    cash_impact_high: forecast.cash_impact_high_usd,
    confidence_band_pct: forecast.confidence_band_pct,
    runway_days: context.runwayDays,
    runway_days_delta_low: forecast.runway_days_delta_low,
    runway_days_delta_high: forecast.runway_days_delta_high,
  };
}

export function runForecastAgent(
  message: string,
  context: ChatDataContext,
): ChatSynthesisWithScenario | null {
  const parsed = parseScenarioIntent(message);
  if (!parsed) return null;

  const baselineSpend =
    parsed.channel === "meta" ? context.adSpend7d : (context.googleAdSpend7d ?? null);

  const poas7d = parsed.channel === "meta" ? context.metaPoas7d : context.googlePoas7d;

  const forecast = runAdSpendScenarioForecast({
    channel: parsed.channel,
    spendChangePct: parsed.spendChangePct,
    baselineSpend7dUsd: baselineSpend,
    poas7d,
    runwayDays: context.runwayDays,
    avgDailyNetOutflow: context.avgDailyNetOutflow,
    referenceDay: context.referenceDay,
  });

  if (!forecast) {
    const channel = channelLabel(parsed.channel);
    const result: ChatSynthesisResult = {
      answer: `Connect ${channel} Ads so I can model spend changes from your trailing 7-day baseline.`,
      citations: [
        {
          source_table: "mart_ad_performance",
          source_date: context.referenceDay,
          metric: "ad_spend",
        },
      ],
      confidence: "low",
      follow_ups: ["Why did profit drop yesterday?", "What is my cash runway?"],
    };
    return result;
  }

  const title = buildScenarioTitle(parsed.channel, parsed.spendChangePct);
  const scenarioCard: ChatScenarioCard = {
    title,
    forecast,
    save_payload: {
      scenario_type: "ad_spend",
      channel: parsed.channel,
      spend_change_pct: parsed.spendChangePct,
      title,
      inputs: {
        baseline_spend_7d_usd: forecast.baseline_spend_7d_usd,
        poas_7d: forecast.poas_7d,
        reference_day: context.referenceDay,
      },
      results: forecast,
    },
    saved: false,
    scenario_id: null,
  };

  return {
    answer: buildScenarioAnswer(forecast),
    citations: buildScenarioCitations(context, forecast),
    confidence: forecast.confidence,
    follow_ups: [
      "What is my cash runway?",
      parsed.spendChangePct > 0
        ? "Which campaigns should I pause?"
        : "What if I increase Meta spend 10%?",
    ],
    scenario_card: scenarioCard,
    scenario_raw_values: enrichCitationRawValues(context, forecast),
  };
}
