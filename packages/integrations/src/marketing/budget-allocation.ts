import { calculatePoas, type CampaignDailyMetrics } from "./poas.js";

export type CampaignPoasInput = {
  channel: string;
  campaign_id: string;
  campaign_name: string;
  ad_spend: number;
  attributed_revenue: number;
  attributed_contribution_margin: number;
  poas: number | null;
};

export type ChannelPoasSummary = {
  channel: string;
  ad_spend: number;
  attributed_revenue: number;
  attributed_contribution_margin: number;
  poas: number | null;
  campaign_count: number;
};

export function buildCampaignPoasInputs(
  rows: Array<CampaignDailyMetrics & { channel: string }>,
  windowDays: number,
  referenceDay: string,
): CampaignPoasInput[] {
  const ref = new Date(`${referenceDay}T00:00:00.000Z`);
  const start = new Date(ref);
  start.setUTCDate(start.getUTCDate() - (windowDays - 1));

  const byChannelCampaign = new Map<
    string,
    {
      channel: string;
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

    const key = `${row.channel}|${row.campaign_id}`;
    const existing = byChannelCampaign.get(key) ?? {
      channel: row.channel,
      campaign_id: row.campaign_id,
      campaign_name: row.campaign_name,
      ad_spend: 0,
      attributed_revenue: 0,
      attributed_contribution_margin: 0,
    };

    existing.ad_spend += row.ad_spend;
    existing.attributed_revenue += row.attributed_revenue;
    existing.attributed_contribution_margin += row.attributed_contribution_margin;
    byChannelCampaign.set(key, existing);
  }

  return [...byChannelCampaign.values()]
    .map((row) => ({
      ...row,
      poas: calculatePoas(row.attributed_contribution_margin, row.ad_spend),
    }))
    .sort((a, b) => (b.poas ?? -1) - (a.poas ?? -1));
}

export function summarizeChannelPoas(inputs: CampaignPoasInput[]): ChannelPoasSummary[] {
  const byChannel = new Map<string, ChannelPoasSummary>();

  for (const row of inputs) {
    const existing = byChannel.get(row.channel) ?? {
      channel: row.channel,
      ad_spend: 0,
      attributed_revenue: 0,
      attributed_contribution_margin: 0,
      poas: null,
      campaign_count: 0,
    };

    existing.ad_spend += row.ad_spend;
    existing.attributed_revenue += row.attributed_revenue;
    existing.attributed_contribution_margin += row.attributed_contribution_margin;
    existing.campaign_count += 1;
    byChannel.set(row.channel, existing);
  }

  return [...byChannel.values()].map((row) => ({
    ...row,
    poas: calculatePoas(row.attributed_contribution_margin, row.ad_spend),
  }));
}
