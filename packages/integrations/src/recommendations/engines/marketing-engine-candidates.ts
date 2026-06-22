import type { CampaignPoasInput } from "../../marketing/budget-allocation.js";
import {
  BUDGET_REALLOCATION_WINDOW_DAYS,
  simulateBudgetReallocationScenarios,
  type BudgetShiftScenario,
} from "../../marketing/budget-reallocation.js";
import type { CampaignDailyMetrics } from "../../marketing/poas.js";
import {
  buildCandidateImpact,
  buildSimilarityHash,
  candidateExpiresAt,
  type RecommendationCandidate,
} from "../recommendation-candidate.js";

const BUDGET_REALLOCATION_CATEGORY = "budget_reallocation";
const CHANNEL_BUDGET_CATEGORY = "channel_budget_optimization";

export function buildMarketingEngineCandidates(input: {
  campaigns: CampaignPoasInput[];
  dailyRows: Array<CampaignDailyMetrics & { channel: string }>;
  referenceDay: string;
  windowDays?: number;
}): RecommendationCandidate[] {
  const windowDays = input.windowDays ?? BUDGET_REALLOCATION_WINDOW_DAYS;
  const totalBudgetUsd = input.campaigns.reduce((sum, row) => sum + row.ad_spend, 0);
  const scenarios = simulateBudgetReallocationScenarios({
    campaigns: input.campaigns,
    dailyRows: input.dailyRows,
    windowDays,
    referenceDay: input.referenceDay,
    totalBudgetUsd,
  });

  return scenarios.map((scenario) => scenarioToCandidate(scenario, input.referenceDay));
}

function scenarioToCandidate(
  scenario: BudgetShiftScenario,
  referenceDay: string,
): RecommendationCandidate {
  const impact = buildCandidateImpact(scenario.projected_profit_delta_monthly_usd);
  const subject = `${scenario.channel}|${scenario.from_campaign_id}|${scenario.to_campaign_id}|${scenario.amount_usd}`;

  return {
    engine: "marketing",
    category: BUDGET_REALLOCATION_CATEGORY,
    title: `Shift $${Math.round(scenario.amount_usd).toLocaleString("en-US")} to ${scenario.to_campaign_name}`,
    body: `Move $${Math.round(scenario.amount_usd).toLocaleString("en-US")}/mo from ${scenario.from_campaign_name} (marginal POAS ${scenario.source_marginal_poas.toFixed(2)}) to ${scenario.to_campaign_name} (marginal POAS ${scenario.target_marginal_poas.toFixed(2)}). Projected +$${scenario.projected_profit_delta_monthly_usd.toLocaleString("en-US")}/mo contribution profit.`,
    impact_low: impact.impact_low,
    impact_high: impact.impact_high,
    confidence: "medium",
    effort: "low",
    evidence: [
      {
        channel: scenario.channel,
        from_campaign_id: scenario.from_campaign_id,
        from_campaign_name: scenario.from_campaign_name,
        to_campaign_id: scenario.to_campaign_id,
        to_campaign_name: scenario.to_campaign_name,
        amount_usd: scenario.amount_usd,
        projected_profit_delta_monthly_usd: scenario.projected_profit_delta_monthly_usd,
        source_marginal_poas: scenario.source_marginal_poas,
        target_marginal_poas: scenario.target_marginal_poas,
      },
    ],
    expires_at: candidateExpiresAt(referenceDay),
    similarity_hash: buildSimilarityHash(BUDGET_REALLOCATION_CATEGORY, subject),
    subject_sku: null,
    source_key: subject,
  };
}

export function buildChannelBudgetOptimizationCandidate(input: {
  recommendations: Array<{
    channel: string;
    current_spend_usd: number;
    recommended_spend_usd: number;
    poas: number | null;
    projected_margin_usd: number;
  }>;
  projected_total_margin_usd: number;
  referenceDay: string;
}): RecommendationCandidate | null {
  if (input.recommendations.length < 2) return null;

  const impact = buildCandidateImpact(input.projected_total_margin_usd);
  const shiftSummary = input.recommendations
    .filter((row) => row.recommended_spend_usd !== row.current_spend_usd)
    .map(
      (row) =>
        `${row.channel}: $${row.current_spend_usd.toLocaleString("en-US")} → $${row.recommended_spend_usd.toLocaleString("en-US")}`,
    )
    .join("; ");

  if (!shiftSummary) return null;

  return {
    engine: "marketing",
    category: CHANNEL_BUDGET_CATEGORY,
    title: "Rebalance Meta and Google budget",
    body: `LP-optimized channel allocation: ${shiftSummary}.`,
    impact_low: impact.impact_low,
    impact_high: impact.impact_high,
    confidence: "medium",
    effort: "low",
    evidence: input.recommendations.map((row) => ({
      channel: row.channel,
      current_spend_usd: row.current_spend_usd,
      recommended_spend_usd: row.recommended_spend_usd,
      poas: row.poas,
      projected_margin_usd: row.projected_margin_usd,
    })),
    expires_at: candidateExpiresAt(input.referenceDay),
    similarity_hash: buildSimilarityHash(
      CHANNEL_BUDGET_CATEGORY,
      input.recommendations.map((row) => row.channel).sort().join("|"),
    ),
    subject_sku: null,
    source_key: "multi_channel_budget",
  };
}
