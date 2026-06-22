import { and, eq, gte, lte } from "drizzle-orm";
import { integrations, martAdPerformanceDaily, type Database } from "@morgan/db";
import {
  buildCampaignPoasInputs,
  BUDGET_REALLOCATION_WINDOW_DAYS,
  buildCampaignMarginalPoasCurves,
  simulateBudgetReallocationScenarios,
  solveChannelBudgetLp,
  summarizeChannelPoas,
  toBudgetReallocationScenarioView,
  type BudgetReallocationScenarioView,
  type CampaignMarginalPoasCurve,
  type CampaignPoasInput,
  type ChannelBudgetLpResult,
  type ChannelPoasSummary,
  type CampaignDailyMetrics,
} from "@morgan/integrations";

function addDays(isoDay: string, days: number): string {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export type MarketingBudgetAllocationPayload = {
  window_days: number;
  reference_day: string;
  total_budget_usd: number;
  campaigns: CampaignPoasInput[];
  channels: ChannelPoasSummary[];
  daily_rows: Array<CampaignDailyMetrics & { channel: string }>;
  marginal_poas_curves: CampaignMarginalPoasCurve[];
  reallocation_scenarios: BudgetReallocationScenarioView[];
  channel_optimization: ChannelBudgetLpResult | null;
  suggest_only: true;
};

async function countConnectedAdChannels(db: Database, storeId: string): Promise<number> {
  const rows = await db
    .select({ provider: integrations.provider })
    .from(integrations)
    .where(and(eq(integrations.storeId, storeId), eq(integrations.status, "connected")));

  const adProviders = new Set(["meta", "google_ads"]);
  return rows.filter((row) => adProviders.has(row.provider)).length;
}

export async function getMarketingBudgetAllocation(
  db: Database,
  storeId: string,
  windowDays = BUDGET_REALLOCATION_WINDOW_DAYS,
): Promise<MarketingBudgetAllocationPayload> {
  const referenceDay = new Date().toISOString().slice(0, 10);
  const sinceDay = addDays(referenceDay, -(windowDays - 1));

  const rows = await db
    .select()
    .from(martAdPerformanceDaily)
    .where(
      and(
        eq(martAdPerformanceDaily.storeId, storeId),
        gte(martAdPerformanceDaily.performanceDate, sinceDay),
        lte(martAdPerformanceDaily.performanceDate, referenceDay),
      ),
    );

  const dailyRows = rows.map((row) => ({
    channel: row.channel,
    campaign_id: row.campaignId,
    campaign_name: row.campaignName,
    day: row.performanceDate,
    ad_spend: Number(row.adSpend),
    attributed_revenue: Number(row.attributedRevenue),
    attributed_contribution_margin: Number(row.attributedContributionMargin),
  }));

  const campaigns = buildCampaignPoasInputs(dailyRows, windowDays, referenceDay);
  const channels = summarizeChannelPoas(campaigns);
  const totalBudgetUsd = campaigns.reduce((sum, row) => sum + row.ad_spend, 0);

  const reallocation_scenarios_raw = simulateBudgetReallocationScenarios({
    campaigns,
    dailyRows,
    windowDays,
    referenceDay,
    totalBudgetUsd,
  });

  const marginal_poas_curves = buildCampaignMarginalPoasCurves({
    campaigns,
    dailyRows,
    windowDays,
    referenceDay,
  });

  const connectedAdChannels = await countConnectedAdChannels(db, storeId);
  const channel_optimization =
    connectedAdChannels >= 2 && channels.length >= 2
      ? solveChannelBudgetLp({
          channels,
          total_budget_usd: totalBudgetUsd,
        })
      : null;

  return {
    window_days: windowDays,
    reference_day: referenceDay,
    total_budget_usd: Math.round(totalBudgetUsd),
    campaigns,
    channels,
    daily_rows: dailyRows,
    marginal_poas_curves,
    reallocation_scenarios: reallocation_scenarios_raw.map(toBudgetReallocationScenarioView),
    channel_optimization,
    suggest_only: true,
  };
}
