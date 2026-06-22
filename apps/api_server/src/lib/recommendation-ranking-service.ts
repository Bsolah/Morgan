import { and, eq } from "drizzle-orm";
import { recommendations, type Database } from "@morgan/db";
import {
  OPEN_RECOMMENDATIONS_LIMIT,
  recommendationExpiresAt,
  scoreRecommendationCandidate,
  selectNonConflictingCandidates,
  urgencyForCategory,
  type RankingWeights,
  type RecommendationConfidence,
  type RecommendationEffort,
} from "@morgan/integrations";
import { env } from "../config.js";
import {
  listPendingRecommendationCandidates,
  updateRecommendationCandidateStatuses,
  type RecommendationCandidateView,
} from "./recommendation-candidate-service.js";

export type StoredRecommendation = {
  id: string;
  store_id: string;
  candidate_id: string | null;
  engine: string;
  category: string;
  title: string;
  body: string;
  impact_low_usd: number;
  impact_high_usd: number;
  confidence: RecommendationConfidence;
  effort: RecommendationEffort;
  rank_score: number;
  rank_position: number;
  subject_sku: string | null;
  evidence: Array<Record<string, unknown>>;
  status: "open" | "accepted" | "dismissed" | "archived" | "expired";
  expires_at: string;
  generated_day: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

const memoryRecommendationsByStore = new Map<string, StoredRecommendation[]>();

export function useMemoryRecommendationStore(): boolean {
  return env.NODE_ENV === "test";
}

export function getRankingWeights(): RankingWeights {
  return {
    impact: env.RECOMMENDATION_RANK_WEIGHT_IMPACT,
    confidence: env.RECOMMENDATION_RANK_WEIGHT_CONFIDENCE,
    urgency: env.RECOMMENDATION_RANK_WEIGHT_URGENCY,
    effort: env.RECOMMENDATION_RANK_WEIGHT_EFFORT,
  };
}

type ScoredCandidate = RecommendationCandidateView & { rank_score: number };

function scoreCandidate(
  candidate: RecommendationCandidateView,
  weights: RankingWeights,
): ScoredCandidate {
  return {
    ...candidate,
    rank_score: scoreRecommendationCandidate({
      impact_low: candidate.impact_low,
      impact_high: candidate.impact_high,
      confidence: candidate.confidence,
      effort: candidate.effort,
      urgency: urgencyForCategory(candidate.category, candidate.evidence),
      weights,
    }),
  };
}

function toStoredRecommendation(
  storeId: string,
  candidate: ScoredCandidate,
  referenceDay: string,
  rankPosition: number,
  id: string,
): StoredRecommendation {
  const now = new Date().toISOString();
  return {
    id,
    store_id: storeId,
    candidate_id: candidate.id,
    engine: candidate.engine,
    category: candidate.category,
    title: candidate.title,
    body: candidate.body,
    impact_low_usd: candidate.impact_low,
    impact_high_usd: candidate.impact_high,
    confidence: candidate.confidence,
    effort: candidate.effort,
    rank_score: candidate.rank_score,
    rank_position: rankPosition,
    subject_sku: candidate.subject_sku,
    evidence: candidate.evidence,
    status: "open",
    expires_at: recommendationExpiresAt(referenceDay),
    generated_day: referenceDay,
    created_at: now,
    updated_at: now,
    resolved_at: null,
  };
}

export function listMemoryRecommendations(
  storeId: string,
  status?: StoredRecommendation["status"],
): StoredRecommendation[] {
  const rows = memoryRecommendationsByStore.get(storeId) ?? [];
  return status ? rows.filter((row) => row.status === status) : rows;
}

export function getMemoryRecommendation(
  storeId: string,
  recommendationId: string,
): StoredRecommendation | null {
  return (memoryRecommendationsByStore.get(storeId) ?? []).find((row) => row.id === recommendationId) ?? null;
}

export function updateMemoryRecommendationStatus(
  storeId: string,
  recommendationId: string,
  status: StoredRecommendation["status"],
): StoredRecommendation | null {
  const rows = memoryRecommendationsByStore.get(storeId) ?? [];
  let updated: StoredRecommendation | null = null;
  const next = rows.map((row) => {
    if (row.id !== recommendationId) return row;
    const resolvedAt = status === "accepted" || status === "dismissed" ? new Date().toISOString() : null;
    updated = {
      ...row,
      status,
      resolved_at: resolvedAt,
      updated_at: new Date().toISOString(),
    };
    return updated;
  });
  memoryRecommendationsByStore.set(storeId, next);
  return updated;
}

export type RankAndPromoteResult = {
  store_id: string;
  reference_day: string;
  pending_count: number;
  promoted_count: number;
  suppressed_conflicts: number;
  skipped_cap: number;
  archived_previous: number;
};

export async function rankAndPromoteRecommendationCandidates(
  db: Database,
  storeId: string,
  referenceDay = new Date().toISOString().slice(0, 10),
): Promise<RankAndPromoteResult> {
  const weights = getRankingWeights();
  const pending = await listPendingRecommendationCandidates(db, storeId);

  const scored = pending
    .map((candidate) => scoreCandidate(candidate, weights))
    .sort((left, right) => right.rank_score - left.rank_score);

  const nonConflicting = selectNonConflictingCandidates(scored);
  const promoted = nonConflicting.slice(0, OPEN_RECOMMENDATIONS_LIMIT);
  const promotedIds = new Set(promoted.map((candidate) => candidate.id));

  const suppressed_conflicts = scored.filter(
    (candidate) =>
      !promotedIds.has(candidate.id) &&
      promoted.some((picked) => {
        const leftSku = candidate.subject_sku?.trim().toLowerCase();
        const rightSku = picked.subject_sku?.trim().toLowerCase();
        return Boolean(leftSku && rightSku && leftSku === rightSku);
      }),
  ).length;

  const skipped_cap = Math.max(0, nonConflicting.length - OPEN_RECOMMENDATIONS_LIMIT);
  const skippedIds = pending.filter((candidate) => !promotedIds.has(candidate.id)).map((c) => c.id);

  let archived_previous = 0;

  if (useMemoryRecommendationStore()) {
    const existing = memoryRecommendationsByStore.get(storeId) ?? [];
    archived_previous = existing.filter((row) => row.status === "open").length;
    const archived = existing.map((row) =>
      row.status === "open"
        ? { ...row, status: "archived" as const, updated_at: new Date().toISOString() }
        : row,
    );

    const inserted = promoted.map((candidate, index) =>
      toStoredRecommendation(
        storeId,
        candidate,
        referenceDay,
        index + 1,
        `rec-test-${referenceDay}-${index}`,
      ),
    );

    memoryRecommendationsByStore.set(storeId, [...archived, ...inserted]);
  } else {
    const openRows = await db
      .select({ id: recommendations.id })
      .from(recommendations)
      .where(and(eq(recommendations.storeId, storeId), eq(recommendations.status, "open")));

    archived_previous = openRows.length;
    const now = new Date();

    if (openRows.length > 0) {
      await db
        .update(recommendations)
        .set({ status: "archived", updatedAt: now })
        .where(and(eq(recommendations.storeId, storeId), eq(recommendations.status, "open")));
    }

    if (promoted.length > 0) {
      await db.insert(recommendations).values(
        promoted.map((candidate, index) => ({
          storeId,
          candidateId: candidate.id,
          engine: candidate.engine,
          category: candidate.category,
          title: candidate.title,
          body: candidate.body,
          impactLowUsd: candidate.impact_low.toFixed(4),
          impactHighUsd: candidate.impact_high.toFixed(4),
          confidence: candidate.confidence,
          effort: candidate.effort,
          rankScore: candidate.rank_score.toFixed(4),
          rankPosition: index + 1,
          subjectSku: candidate.subject_sku,
          evidence: candidate.evidence,
          status: "open",
          expiresAt: new Date(recommendationExpiresAt(referenceDay)),
          generatedDay: referenceDay,
          updatedAt: now,
        })),
      );
    }
  }

  await updateRecommendationCandidateStatuses(
    db,
    storeId,
    [
      ...promoted.map((candidate) => ({ id: candidate.id, status: "promoted" as const })),
      ...skippedIds.map((id) => ({ id, status: "skipped" as const })),
    ],
  );

  return {
    store_id: storeId,
    reference_day: referenceDay,
    pending_count: pending.length,
    promoted_count: promoted.length,
    suppressed_conflicts,
    skipped_cap,
    archived_previous,
  };
}
