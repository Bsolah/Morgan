import type { CampaignPoasInput } from "../../marketing/budget-allocation.js";
import {
  buildCandidateImpact,
  buildSimilarityHash,
  candidateExpiresAt,
  type RecommendationCandidate,
} from "../recommendation-candidate.js";

const BUDGET_REALLOCATION_CATEGORY = "budget_reallocation";
const MIN_SHIFT_SOURCE_SPEND_USD = 100;
const MIN_POAS_GAP = 0.75;
const MIN_TARGET_POAS = 1.25;

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

function projectedProfitDeltaUsd(
  shiftAmountUsd: number,
  sourcePoas: number,
  targetPoas: number,
): number {
  const sourceProfit = shiftAmountUsd * sourcePoas;
  const targetProfit = shiftAmountUsd * targetPoas;
  return Math.max(0, targetProfit - sourceProfit);
}

export function buildMarketingEngineCandidates(
  campaigns: CampaignPoasInput[],
  referenceDay: string,
): RecommendationCandidate[] {
  const candidates: RecommendationCandidate[] = [];

  for (const [channel, channelCampaigns] of groupCampaignsByChannel(campaigns)) {
    const spendEligible = channelCampaigns.filter((row) => row.ad_spend > 0);
    if (spendEligible.length < 2) continue;

    const sorted = [...spendEligible].sort((left, right) => (left.poas ?? -1) - (right.poas ?? -1));
    const source = sorted.find(
      (row) =>
        row.ad_spend >= MIN_SHIFT_SOURCE_SPEND_USD &&
        row.poas != null &&
        row.poas < 1,
    );
    const target = [...sorted]
      .reverse()
      .find((row) => row.poas != null && row.poas >= MIN_TARGET_POAS);

    if (!source || !target || source.campaign_id === target.campaign_id) continue;
    if ((target.poas ?? 0) - (source.poas ?? 0) < MIN_POAS_GAP) continue;

    const shiftAmount = Math.min(source.ad_spend, 500);
    const impactAmount = projectedProfitDeltaUsd(shiftAmount, source.poas ?? 0, target.poas ?? 0);
    const impact = buildCandidateImpact(impactAmount);
    const subject = `${channel}|${source.campaign_id}|${target.campaign_id}`;

    candidates.push({
      engine: "marketing",
      category: BUDGET_REALLOCATION_CATEGORY,
      title: `Shift ${channel} budget to ${target.campaign_name}`,
      body: `Move about $${Math.round(shiftAmount).toLocaleString("en-US")}/wk from ${source.campaign_name} (POAS ${(source.poas ?? 0).toFixed(2)}) to ${target.campaign_name} (POAS ${(target.poas ?? 0).toFixed(2)}).`,
      impact_low: impact.impact_low,
      impact_high: impact.impact_high,
      confidence: "medium",
      effort: "low",
      evidence: [
        {
          channel,
          source_campaign_id: source.campaign_id,
          source_campaign_name: source.campaign_name,
          source_poas: source.poas,
          source_ad_spend: source.ad_spend,
          target_campaign_id: target.campaign_id,
          target_campaign_name: target.campaign_name,
          target_poas: target.poas,
          shift_amount_usd: shiftAmount,
        },
      ],
      expires_at: candidateExpiresAt(referenceDay),
      similarity_hash: buildSimilarityHash(BUDGET_REALLOCATION_CATEGORY, subject),
      subject_sku: null,
      source_key: subject,
    });
  }

  return candidates;
}
