export function calculateRoas(attributedRevenue: number, adSpend: number): number | null {
  if (adSpend <= 0) return null;
  return attributedRevenue / adSpend;
}

export function calculatePoas(attributedContributionMargin: number, adSpend: number): number | null {
  if (adSpend <= 0) return null;
  return attributedContributionMargin / adSpend;
}

export type CampaignDailyMetrics = {
  campaign_id: string;
  campaign_name: string;
  day: string;
  ad_spend: number;
  attributed_revenue: number;
  attributed_contribution_margin: number;
};

export function aggregateCampaignWindow(
  rows: CampaignDailyMetrics[],
  windowDays: number,
  referenceDay: string,
): Map<
  string,
  {
    campaign_id: string;
    campaign_name: string;
    ad_spend: number;
    attributed_revenue: number;
    attributed_contribution_margin: number;
    poas: number | null;
    roas: number | null;
  }
> {
  const ref = new Date(`${referenceDay}T00:00:00.000Z`);
  const start = new Date(ref);
  start.setUTCDate(start.getUTCDate() - (windowDays - 1));

  const byCampaign = new Map<
    string,
    {
      campaign_id: string;
      campaign_name: string;
      ad_spend: number;
      attributed_revenue: number;
      attributed_contribution_margin: number;
    }
  >();

  for (const row of rows) {
    const day = new Date(`${row.day}T00:00:00.000Z`);
    if (day < start || day > ref) continue;

    const existing = byCampaign.get(row.campaign_id) ?? {
      campaign_id: row.campaign_id,
      campaign_name: row.campaign_name,
      ad_spend: 0,
      attributed_revenue: 0,
      attributed_contribution_margin: 0,
    };

    existing.ad_spend += row.ad_spend;
    existing.attributed_revenue += row.attributed_revenue;
    existing.attributed_contribution_margin += row.attributed_contribution_margin;
    byCampaign.set(row.campaign_id, existing);
  }

  const result = new Map<
    string,
    {
      campaign_id: string;
      campaign_name: string;
      ad_spend: number;
      attributed_revenue: number;
      attributed_contribution_margin: number;
      poas: number | null;
      roas: number | null;
    }
  >();

  for (const [campaignId, metrics] of byCampaign) {
    result.set(campaignId, {
      ...metrics,
      poas: calculatePoas(metrics.attributed_contribution_margin, metrics.ad_spend),
      roas: calculateRoas(metrics.attributed_revenue, metrics.ad_spend),
    });
  }

  return result;
}

export function hasConsecutiveLowPoasDays(
  dailyRows: CampaignDailyMetrics[],
  campaignId: string,
  consecutiveDays: number,
  poasThreshold: number,
): boolean {
  const campaignDays = dailyRows
    .filter((row) => row.campaign_id === campaignId && row.ad_spend > 0)
    .sort((a, b) => a.day.localeCompare(b.day));

  if (campaignDays.length < consecutiveDays) return false;

  let streak = 0;
  for (const row of campaignDays) {
    const poas = calculatePoas(row.attributed_contribution_margin, row.ad_spend);
    if (poas != null && poas < poasThreshold) {
      streak += 1;
      if (streak >= consecutiveDays) return true;
    } else {
      streak = 0;
    }
  }

  return false;
}

export type CampaignDailyTrendPoint = {
  day: string;
  ad_spend: number;
  poas: number | null;
};

export function buildCampaignDailyTrend(
  rows: CampaignDailyMetrics[],
  trendDays: number,
  referenceDay: string,
): CampaignDailyTrendPoint[] {
  const ref = new Date(`${referenceDay}T00:00:00.000Z`);
  const start = new Date(ref);
  start.setUTCDate(start.getUTCDate() - (trendDays - 1));

  const byDay = new Map<string, { ad_spend: number; attributed_contribution_margin: number }>();

  for (const row of rows) {
    const day = new Date(`${row.day}T00:00:00.000Z`);
    if (day < start || day > ref) continue;

    const existing = byDay.get(row.day) ?? { ad_spend: 0, attributed_contribution_margin: 0 };
    existing.ad_spend += row.ad_spend;
    existing.attributed_contribution_margin += row.attributed_contribution_margin;
    byDay.set(row.day, existing);
  }

  const points: CampaignDailyTrendPoint[] = [];
  for (let offset = 0; offset < trendDays; offset += 1) {
    const dayDate = new Date(start);
    dayDate.setUTCDate(dayDate.getUTCDate() + offset);
    const day = dayDate.toISOString().slice(0, 10);
    const metrics = byDay.get(day) ?? { ad_spend: 0, attributed_contribution_margin: 0 };
    points.push({
      day,
      ad_spend: metrics.ad_spend,
      poas: calculatePoas(metrics.attributed_contribution_margin, metrics.ad_spend),
    });
  }

  return points;
}
