import {
  aggregateCampaignWindow,
  calculatePoas,
  type CampaignDailyMetrics,
} from "./poas.js";

export const AD_WASTE_LEAK_THRESHOLDS = {
  min_consecutive_low_poas_days: 7,
  poas_threshold: 1.0,
  min_spend_usd: 100,
  resolve_consecutive_high_poas_days: 3,
  projection_days: 30,
  spend_window_days: 7,
} as const;

export type AdWasteLeakEvidence = {
  channel: string;
  campaign: string;
  campaign_id: string;
  poas: number | null;
  spend_7d: number;
};

export type AdWasteLeakEvaluation = {
  qualifies: boolean;
  should_resolve: boolean;
  amount_at_risk_usd: number;
  evidence: AdWasteLeakEvidence | null;
};

/** Projected 30d margin waste at the current 7d spend rate when POAS < 1. */
export function projectAdWasteAmountAtRiskUsd(spend7dUsd: number, poas7d: number | null): number {
  if (spend7dUsd <= 0 || poas7d == null || poas7d >= AD_WASTE_LEAK_THRESHOLDS.poas_threshold) {
    return 0;
  }

  const waste7d = spend7dUsd * (1 - poas7d);
  return (
    waste7d *
    (AD_WASTE_LEAK_THRESHOLDS.projection_days / AD_WASTE_LEAK_THRESHOLDS.spend_window_days)
  );
}

/** Trailing calendar window: every day must have spend and POAS below threshold. */
export function hasTrailingSustainedLowPoas(
  dailyRows: CampaignDailyMetrics[],
  campaignId: string,
  windowDays: number,
  poasThreshold: number,
  referenceDay: string,
): boolean {
  const ref = new Date(`${referenceDay}T00:00:00.000Z`);
  const byDay = new Map(
    dailyRows
      .filter((row) => row.campaign_id === campaignId)
      .map((row) => [row.day, row] as const),
  );

  for (let offset = 0; offset < windowDays; offset += 1) {
    const dayDate = new Date(ref);
    dayDate.setUTCDate(dayDate.getUTCDate() - (windowDays - 1 - offset));
    const day = dayDate.toISOString().slice(0, 10);
    const row = byDay.get(day);
    if (row == null || row.ad_spend <= 0) return false;

    const poas = calculatePoas(row.attributed_contribution_margin, row.ad_spend);
    if (poas == null || poas >= poasThreshold) return false;
  }

  return true;
}

/** Trailing calendar window: every day must have spend and POAS at or above threshold. */
export function hasTrailingSustainedHighPoas(
  dailyRows: CampaignDailyMetrics[],
  campaignId: string,
  windowDays: number,
  poasThreshold: number,
  referenceDay: string,
): boolean {
  const ref = new Date(`${referenceDay}T00:00:00.000Z`);
  const byDay = new Map(
    dailyRows
      .filter((row) => row.campaign_id === campaignId)
      .map((row) => [row.day, row] as const),
  );

  for (let offset = 0; offset < windowDays; offset += 1) {
    const dayDate = new Date(ref);
    dayDate.setUTCDate(dayDate.getUTCDate() - (windowDays - 1 - offset));
    const day = dayDate.toISOString().slice(0, 10);
    const row = byDay.get(day);
    if (row == null || row.ad_spend <= 0) return false;

    const poas = calculatePoas(row.attributed_contribution_margin, row.ad_spend);
    if (poas == null || poas < poasThreshold) return false;
  }

  return true;
}

export function buildAdWasteLeakEvidence(
  channel: string,
  campaignName: string,
  campaignId: string,
  poas7d: number | null,
  spend7d: number,
): AdWasteLeakEvidence {
  return {
    channel,
    campaign: campaignName,
    campaign_id: campaignId,
    poas: poas7d,
    spend_7d: spend7d,
  };
}

export function evaluateAdWasteLeak(
  dailyRows: CampaignDailyMetrics[],
  campaignId: string,
  channel: string,
  referenceDay: string,
): AdWasteLeakEvaluation {
  const campaignName = dailyRows.find((row) => row.campaign_id === campaignId)?.campaign_name ?? campaignId;
  const window = aggregateCampaignWindow(
    dailyRows,
    AD_WASTE_LEAK_THRESHOLDS.spend_window_days,
    referenceDay,
  );
  const metrics = window.get(campaignId);

  if (metrics == null) {
    return {
      qualifies: false,
      should_resolve: false,
      amount_at_risk_usd: 0,
      evidence: null,
    };
  }

  const qualifies =
    metrics.ad_spend >= AD_WASTE_LEAK_THRESHOLDS.min_spend_usd &&
    hasTrailingSustainedLowPoas(
      dailyRows,
      campaignId,
      AD_WASTE_LEAK_THRESHOLDS.min_consecutive_low_poas_days,
      AD_WASTE_LEAK_THRESHOLDS.poas_threshold,
      referenceDay,
    );

  const should_resolve = hasTrailingSustainedHighPoas(
    dailyRows,
    campaignId,
    AD_WASTE_LEAK_THRESHOLDS.resolve_consecutive_high_poas_days,
    AD_WASTE_LEAK_THRESHOLDS.poas_threshold,
    referenceDay,
  );

  const evidence = buildAdWasteLeakEvidence(
    channel,
    campaignName,
    campaignId,
    metrics.poas,
    metrics.ad_spend,
  );

  return {
    qualifies,
    should_resolve,
    amount_at_risk_usd: qualifies
      ? projectAdWasteAmountAtRiskUsd(metrics.ad_spend, metrics.poas)
      : 0,
    evidence: qualifies ? evidence : null,
  };
}
