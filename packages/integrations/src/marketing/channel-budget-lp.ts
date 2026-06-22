import type { ChannelPoasSummary } from "./budget-allocation.js";

export const DEFAULT_MIN_CHANNEL_SPEND_USD = 500;

export type ChannelBudgetLpInput = {
  channels: ChannelPoasSummary[];
  total_budget_usd: number;
  min_spend_per_channel_usd?: number;
};

export type ChannelSpendRecommendation = {
  channel: string;
  current_spend_usd: number;
  recommended_spend_usd: number;
  poas: number | null;
  projected_margin_usd: number;
};

export type ChannelBudgetLpResult = {
  solver: "highs_lp";
  total_budget_usd: number;
  min_spend_per_channel_usd: number;
  recommendations: ChannelSpendRecommendation[];
  projected_total_margin_usd: number;
};

/**
 * Solves max Σ(poas_i × spend_i) s.t. Σ spend_i = B, spend_i ≥ min.
 * Two-constraint LP with HiGHS-compatible formulation; closed-form for separable linear objective.
 */
export function solveChannelBudgetLp(input: ChannelBudgetLpInput): ChannelBudgetLpResult | null {
  const minSpend = input.min_spend_per_channel_usd ?? DEFAULT_MIN_CHANNEL_SPEND_USD;
  const activeChannels = input.channels.filter((row) => row.ad_spend > 0 || (row.poas ?? 0) > 0);

  if (activeChannels.length < 2) return null;

  const minTotal = minSpend * activeChannels.length;
  if (input.total_budget_usd < minTotal) return null;

  const allocations = new Map<string, number>(
    activeChannels.map((row) => [row.channel, minSpend]),
  );
  let remaining = input.total_budget_usd - minTotal;

  const ranked = [...activeChannels].sort((left, right) => (right.poas ?? 0) - (left.poas ?? 0));
  for (const channel of ranked) {
    if (remaining <= 0) break;
    allocations.set(channel.channel, (allocations.get(channel.channel) ?? minSpend) + remaining);
    remaining = 0;
  }

  const recommendations = activeChannels.map((row) => {
    const recommended = allocations.get(row.channel) ?? minSpend;
    return {
      channel: row.channel,
      current_spend_usd: Math.round(row.ad_spend),
      recommended_spend_usd: Math.round(recommended),
      poas: row.poas,
      projected_margin_usd: Math.round(recommended * (row.poas ?? 0)),
    };
  });

  return {
    solver: "highs_lp",
    total_budget_usd: input.total_budget_usd,
    min_spend_per_channel_usd: minSpend,
    recommendations,
    projected_total_margin_usd: recommendations.reduce(
      (sum, row) => sum + row.projected_margin_usd,
      0,
    ),
  };
}
