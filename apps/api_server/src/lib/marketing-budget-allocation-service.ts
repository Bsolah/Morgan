import { and, eq, gte, lte } from "drizzle-orm";
import { martAdPerformanceDaily, type Database } from "@morgan/db";
import {
  buildCampaignPoasInputs,
  summarizeChannelPoas,
  type CampaignPoasInput,
  type ChannelPoasSummary,
} from "@morgan/integrations";

function addDays(isoDay: string, days: number): string {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export type MarketingBudgetAllocationPayload = {
  window_days: number;
  reference_day: string;
  campaigns: CampaignPoasInput[];
  channels: ChannelPoasSummary[];
};

export async function getMarketingBudgetAllocation(
  db: Database,
  storeId: string,
  windowDays = 7,
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

  return {
    window_days: windowDays,
    reference_day: referenceDay,
    campaigns,
    channels,
  };
}
