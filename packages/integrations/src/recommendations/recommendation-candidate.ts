import {
  computeImpactRange,
  confidenceForSeverity,
  effortForLeakType,
  recommendationExpiresAt,
  type RecommendationConfidence,
  type RecommendationEffort,
} from "./recommendation-ranking.js";

export const RECOMMENDATION_CANDIDATE_DEDUPE_WINDOW_DAYS = 7;

export type RecommendationEngine = "leak" | "inventory" | "marketing" | "pricing";

export type RecommendationCandidate = {
  engine: RecommendationEngine;
  category: string;
  title: string;
  body: string;
  impact_low: number;
  impact_high: number;
  confidence: RecommendationConfidence;
  effort: RecommendationEffort;
  evidence: Array<Record<string, unknown>>;
  expires_at: string;
  similarity_hash: string;
  subject_sku?: string | null;
  source_key?: string | null;
};

export type RecommendationCandidateDedupeRecord = {
  similarity_hash: string;
  created_at: string;
};

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

export function buildSimilarityHash(category: string, subject: string): string {
  return `${normalizeToken(category)}:${normalizeToken(subject)}`;
}

export function extractSkuFromEvidence(
  evidence: Array<Record<string, unknown>> | null | undefined,
): string | null {
  const first = evidence?.[0];
  const sku = first?.sku;
  return typeof sku === "string" && sku.length > 0 ? sku : null;
}

export function similaritySubjectForLeak(input: {
  leak_type: string;
  external_key: string;
  evidence: Array<Record<string, unknown>> | null | undefined;
}): string {
  const sku = extractSkuFromEvidence(input.evidence);
  if (sku) return sku;
  if (input.leak_type === "ad_waste") {
    const campaignId = input.evidence?.[0]?.campaign_id;
    if (typeof campaignId === "string" && campaignId.length > 0) {
      return `campaign:${campaignId}`;
    }
  }
  return input.external_key;
}

export function isWithinCandidateDedupeWindow(
  createdAtIso: string,
  referenceDay: string,
  windowDays = RECOMMENDATION_CANDIDATE_DEDUPE_WINDOW_DAYS,
): boolean {
  const createdDay = createdAtIso.slice(0, 10);
  const reference = new Date(`${referenceDay}T12:00:00.000Z`);
  const created = new Date(`${createdDay}T12:00:00.000Z`);
  const diffDays = Math.floor((reference.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays < windowDays;
}

export function dedupeRecommendationCandidates(
  candidates: RecommendationCandidate[],
  existing: RecommendationCandidateDedupeRecord[],
  referenceDay: string,
): RecommendationCandidate[] {
  const recentHashes = new Set(
    existing
      .filter((row) => isWithinCandidateDedupeWindow(row.created_at, referenceDay))
      .map((row) => row.similarity_hash),
  );

  const seen = new Set<string>();
  const deduped: RecommendationCandidate[] = [];

  for (const candidate of candidates) {
    if (recentHashes.has(candidate.similarity_hash)) continue;
    if (seen.has(candidate.similarity_hash)) continue;
    seen.add(candidate.similarity_hash);
    deduped.push(candidate);
  }

  return deduped;
}

export function buildCandidateImpact(amountUsd: number | null | undefined): {
  impact_low: number;
  impact_high: number;
} {
  const range = computeImpactRange(
    amountUsd != null && Number.isFinite(amountUsd) && amountUsd > 0 ? amountUsd : null,
  );
  return {
    impact_low: range.impact_low_usd ?? 0,
    impact_high: range.impact_high_usd ?? 0,
  };
}

export function candidateExpiresAt(referenceDay: string): string {
  const day = recommendationExpiresAt(referenceDay);
  return `${day}T23:59:59.000Z`;
}

export function leakSeverityToConfidence(severity: string): RecommendationConfidence {
  return confidenceForSeverity(severity);
}

export function leakTypeToEffort(leakType: string): RecommendationEffort {
  return effortForLeakType(leakType);
}
