import { leakTypeLabel } from "../finance/profit-leak-copy.js";

export type RecommendationEffort = "low" | "medium" | "high";
export type RecommendationConfidence = "high" | "medium" | "low";
export type RecommendationSeverity = "critical" | "warning" | "info";

const EFFORT_WEIGHT: Record<RecommendationEffort, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const CONFIDENCE_WEIGHT: Record<RecommendationConfidence, number> = {
  high: 1,
  medium: 0.75,
  low: 0.5,
};

const URGENCY_WEIGHT: Record<RecommendationSeverity, number> = {
  critical: 1.25,
  warning: 1,
  info: 0.85,
};

export const OPEN_RECOMMENDATIONS_LIMIT = 5;

export function effortForLeakType(leakType: string): RecommendationEffort {
  if (leakType === "ad_waste" || leakType === "discount_bleed") return "low";
  if (leakType === "dead_stock") return "high";
  return "medium";
}

export function confidenceForSeverity(severity: string): RecommendationConfidence {
  if (severity === "critical") return "high";
  if (severity === "info") return "low";
  return "medium";
}

export function computeRecommendationRankScore(input: {
  impactUsd: number;
  confidence: RecommendationConfidence;
  effort: RecommendationEffort;
  severity: RecommendationSeverity;
}): number {
  const impact = Math.max(0, input.impactUsd);
  const effort = EFFORT_WEIGHT[input.effort];
  if (effort <= 0 || impact <= 0) return 0;

  const score = (impact * CONFIDENCE_WEIGHT[input.confidence] * URGENCY_WEIGHT[input.severity]) / effort;
  return Math.round(score * 100) / 100;
}

export function computeImpactRange(amountUsd: number | null): {
  impact_low_usd: number | null;
  impact_high_usd: number | null;
} {
  if (amountUsd == null || !Number.isFinite(amountUsd) || amountUsd <= 0) {
    return { impact_low_usd: null, impact_high_usd: null };
  }

  const low = Math.round(amountUsd * 0.85);
  const high = Math.round(amountUsd * 1.15);
  return { impact_low_usd: low, impact_high_usd: high };
}

export function recommendationExpiresAt(referenceDay: string): string {
  const date = new Date(`${referenceDay}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function categoryLabelForLeakType(leakType: string): string {
  return leakTypeLabel(leakType);
}

export function formatRecommendationImpactRange(
  impactLowUsd: number | null,
  impactHighUsd: number | null,
): string | null {
  if (impactLowUsd == null && impactHighUsd == null) return null;

  const low = impactLowUsd ?? impactHighUsd ?? 0;
  const high = impactHighUsd ?? impactLowUsd ?? 0;
  if (Math.round(low) === Math.round(high)) {
    return `\$${Math.round(low).toLocaleString("en-US")}`;
  }
  return `\$${Math.round(low).toLocaleString("en-US")}–\$${Math.round(high).toLocaleString("en-US")}`;
}
