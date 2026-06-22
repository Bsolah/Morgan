import { calculatePoas, type CampaignDailyMetrics } from "./poas.js";
import type { CampaignPoasInput } from "./budget-allocation.js";

export const BUDGET_REALLOCATION_WINDOW_DAYS = 30;
export const BUDGET_SHIFT_INCREMENT_USD = 500;
export const MIN_MONTHLY_PROFIT_DELTA_USD = 200;

export type BudgetShiftScenario = {
  channel: string;
  from_campaign_id: string;
  from_campaign_name: string;
  to_campaign_id: string;
  to_campaign_name: string;
  amount_usd: number;
  projected_profit_delta_monthly_usd: number;
  source_marginal_poas: number;
  target_marginal_poas: number;
};

export type BudgetReallocationScenarioView = BudgetShiftScenario & {
  from_campaign: string;
  to_campaign: string;
  amount: number;
  projected_profit_delta: number;
};

export type MarginalPoasCurvePoint = {
  cumulative_spend_usd: number;
  average_poas: number | null;
  marginal_poas: number | null;
};

export type CampaignMarginalPoasCurve = {
  channel: string;
  campaign_id: string;
  campaign_name: string;
  window_days: number;
  marginal_poas_30d: number;
  curve_points: MarginalPoasCurvePoint[];
};

export function toBudgetReallocationScenarioView(
  scenario: BudgetShiftScenario,
): BudgetReallocationScenarioView {
  return {
    ...scenario,
    from_campaign: scenario.from_campaign_name,
    to_campaign: scenario.to_campaign_name,
    amount: scenario.amount_usd,
    projected_profit_delta: scenario.projected_profit_delta_monthly_usd,
  };
}

export function buildMarginalPoasForCampaign(
  dailyRows: Array<CampaignDailyMetrics & { channel: string }>,
  campaignId: string,
  windowDays: number,
  referenceDay: string,
): number {
  const campaignDays = filterCampaignDaysInWindow(dailyRows, campaignId, windowDays, referenceDay);

  if (campaignDays.length === 0) return 0;
  if (campaignDays.length === 1) {
    const row = campaignDays[0]!;
    return calculatePoas(row.attributed_contribution_margin, row.ad_spend) ?? 0;
  }

  const mid = Math.floor(campaignDays.length / 2);
  const older = campaignDays.slice(0, mid);
  const recent = campaignDays.slice(mid);

  const olderSpend = older.reduce((sum, row) => sum + row.ad_spend, 0);
  const olderMargin = older.reduce((sum, row) => sum + row.attributed_contribution_margin, 0);
  const recentSpend = recent.reduce((sum, row) => sum + row.ad_spend, 0);
  const recentMargin = recent.reduce((sum, row) => sum + row.attributed_contribution_margin, 0);

  const incrementalSpend = recentSpend - olderSpend;
  const incrementalMargin = recentMargin - olderMargin;
  if (incrementalSpend > 0) {
    return incrementalMargin / incrementalSpend;
  }

  return calculatePoas(recentMargin, recentSpend) ?? calculatePoas(olderMargin, olderSpend) ?? 0;
}

const DEFAULT_CURVE_BUCKET_COUNT = 4;

function filterCampaignDaysInWindow(
  dailyRows: Array<CampaignDailyMetrics & { channel: string }>,
  campaignId: string,
  windowDays: number,
  referenceDay: string,
): Array<CampaignDailyMetrics & { channel: string }> {
  const ref = new Date(`${referenceDay}T00:00:00.000Z`);
  const start = new Date(ref);
  start.setUTCDate(start.getUTCDate() - (windowDays - 1));

  return dailyRows
    .filter((row) => {
      if (row.campaign_id !== campaignId || row.ad_spend <= 0) return false;
      const day = new Date(`${row.day}T00:00:00.000Z`);
      return day >= start && day <= ref;
    })
    .sort((left, right) => left.day.localeCompare(right.day));
}

export function buildMarginalPoasCurvePoints(
  dailyRows: Array<CampaignDailyMetrics & { channel: string }>,
  campaignId: string,
  windowDays: number,
  referenceDay: string,
  bucketCount = DEFAULT_CURVE_BUCKET_COUNT,
): MarginalPoasCurvePoint[] {
  const campaignDays = filterCampaignDaysInWindow(dailyRows, campaignId, windowDays, referenceDay);
  if (campaignDays.length === 0) return [];

  const bucketSize = Math.max(1, Math.ceil(campaignDays.length / bucketCount));
  const spendBuckets: Array<{ spend: number; margin: number }> = [];

  for (let index = 0; index < campaignDays.length; index += bucketSize) {
    const slice = campaignDays.slice(index, index + bucketSize);
    spendBuckets.push({
      spend: slice.reduce((sum, row) => sum + row.ad_spend, 0),
      margin: slice.reduce((sum, row) => sum + row.attributed_contribution_margin, 0),
    });
  }

  let cumulativeSpend = 0;
  let cumulativeMargin = 0;

  return spendBuckets.map((bucket) => {
    const previousSpend = cumulativeSpend;
    const previousMargin = cumulativeMargin;
    cumulativeSpend += bucket.spend;
    cumulativeMargin += bucket.margin;

    const averagePoas = calculatePoas(bucket.margin, bucket.spend);
    const incrementalSpend = cumulativeSpend - previousSpend;
    const incrementalMargin = cumulativeMargin - previousMargin;
    const marginalPoas =
      previousSpend === 0
        ? averagePoas
        : incrementalSpend > 0
          ? incrementalMargin / incrementalSpend
          : averagePoas;

    return {
      cumulative_spend_usd: Math.round(cumulativeSpend),
      average_poas: averagePoas != null ? Math.round(averagePoas * 100) / 100 : null,
      marginal_poas: marginalPoas != null ? Math.round(marginalPoas * 100) / 100 : null,
    };
  });
}

export function buildCampaignMarginalPoasCurves(input: {
  campaigns: CampaignPoasInput[];
  dailyRows: Array<CampaignDailyMetrics & { channel: string }>;
  windowDays: number;
  referenceDay: string;
}): CampaignMarginalPoasCurve[] {
  return input.campaigns
    .filter((campaign) => campaign.ad_spend >= BUDGET_SHIFT_INCREMENT_USD)
    .map((campaign) => ({
      channel: campaign.channel,
      campaign_id: campaign.campaign_id,
      campaign_name: campaign.campaign_name,
      window_days: input.windowDays,
      marginal_poas_30d: Math.round(
        buildMarginalPoasForCampaign(
          input.dailyRows,
          campaign.campaign_id,
          input.windowDays,
          input.referenceDay,
        ) * 100,
      ) / 100,
      curve_points: buildMarginalPoasCurvePoints(
        input.dailyRows,
        campaign.campaign_id,
        input.windowDays,
        input.referenceDay,
      ),
    }))
    .sort((left, right) => right.marginal_poas_30d - left.marginal_poas_30d);
}

function groupCampaignsByChannel(
  campaigns: CampaignPoasInput[],
): Map<string, CampaignPoasInput[]> {
  const grouped = new Map<string, CampaignPoasInput[]>();
  for (const campaign of campaigns) {
    const rows = grouped.get(campaign.channel) ?? [];
    rows.push(campaign);
    grouped.set(campaign.channel, rows);
  }
  return grouped;
}

export function simulateBudgetReallocationScenarios(input: {
  campaigns: CampaignPoasInput[];
  dailyRows: Array<CampaignDailyMetrics & { channel: string }>;
  windowDays: number;
  referenceDay: string;
  totalBudgetUsd: number;
}): BudgetShiftScenario[] {
  const scenarios: BudgetShiftScenario[] = [];

  for (const [channel, channelCampaigns] of groupCampaignsByChannel(input.campaigns)) {
    const eligible = channelCampaigns.filter((row) => row.ad_spend >= BUDGET_SHIFT_INCREMENT_USD);
    if (eligible.length < 2) continue;

    const marginalByCampaign = new Map(
      eligible.map((campaign) => [
        campaign.campaign_id,
        buildMarginalPoasForCampaign(
          input.dailyRows,
          campaign.campaign_id,
          input.windowDays,
          input.referenceDay,
        ),
      ]),
    );

    const sorted = [...eligible].sort(
      (left, right) =>
        (marginalByCampaign.get(left.campaign_id) ?? 0) -
        (marginalByCampaign.get(right.campaign_id) ?? 0),
    );

    for (const source of sorted) {
      const sourceMarginal = marginalByCampaign.get(source.campaign_id) ?? 0;
      for (const target of [...sorted].reverse()) {
        if (source.campaign_id === target.campaign_id) continue;

        const targetMarginal = marginalByCampaign.get(target.campaign_id) ?? 0;
        if (targetMarginal <= sourceMarginal) continue;

        const maxShift = Math.min(source.ad_spend, input.totalBudgetUsd);
        for (
          let shift = BUDGET_SHIFT_INCREMENT_USD;
          shift <= maxShift;
          shift += BUDGET_SHIFT_INCREMENT_USD
        ) {
          const monthlyProfitDelta =
            input.windowDays >= 30
              ? shift * (targetMarginal - sourceMarginal)
              : (shift * (targetMarginal - sourceMarginal) / input.windowDays) * 30;
          if (monthlyProfitDelta <= MIN_MONTHLY_PROFIT_DELTA_USD) continue;

          scenarios.push({
            channel,
            from_campaign_id: source.campaign_id,
            from_campaign_name: source.campaign_name,
            to_campaign_id: target.campaign_id,
            to_campaign_name: target.campaign_name,
            amount_usd: shift,
            projected_profit_delta_monthly_usd: Math.round(monthlyProfitDelta),
            source_marginal_poas: Math.round(sourceMarginal * 100) / 100,
            target_marginal_poas: Math.round(targetMarginal * 100) / 100,
          });
        }
      }
    }
  }

  return scenarios
    .sort(
      (left, right) =>
        right.projected_profit_delta_monthly_usd - left.projected_profit_delta_monthly_usd,
    )
    .slice(0, 3);
}
