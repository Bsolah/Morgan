import { randomUUID } from "node:crypto";
import type { RecommendationItem } from "./recommendations-data.js";
import { SAMPLE_OPEN } from "./recommendations-data.js";

export type RecommendationStatus = "open" | "accepted" | "dismissed";

export type RecommendationStateRecord = {
  status: RecommendationStatus;
  accepted_at?: string;
  dismissed_at?: string;
  dismiss_reason?: string;
  dismiss_comment?: string;
};

const stateByStore = new Map<string, Map<string, RecommendationStateRecord>>();

export function resetRecommendationState(): void {
  stateByStore.clear();
}

function storeState(storeId: string): Map<string, RecommendationStateRecord> {
  let state = stateByStore.get(storeId);
  if (!state) {
    state = new Map();
    stateByStore.set(storeId, state);
  }
  return state;
}

export function getRecommendationState(
  storeId: string,
  recommendationId: string,
): RecommendationStateRecord | undefined {
  return storeState(storeId).get(recommendationId);
}

function baseItem(recommendationId: string): Omit<RecommendationItem, "rank"> | undefined {
  return SAMPLE_OPEN.find((item) => item.id === recommendationId);
}

export function applyRecommendationState(
  storeId: string,
  item: Omit<RecommendationItem, "rank">,
  rank: number,
): RecommendationItem {
  const state = getRecommendationState(storeId, item.id);
  return {
    ...item,
    rank,
    status: state?.status ?? "open",
    accepted_at: state?.accepted_at,
  };
}

export function markRecommendationAccepted(
  storeId: string,
  recommendationId: string,
  acceptedAt: string,
): RecommendationStateRecord {
  const record: RecommendationStateRecord = {
    status: "accepted",
    accepted_at: acceptedAt,
  };
  storeState(storeId).set(recommendationId, record);
  return record;
}

export function markRecommendationDismissed(
  storeId: string,
  recommendationId: string,
  dismissedAt: string,
  reason: string,
  comment?: string,
): RecommendationStateRecord {
  const record: RecommendationStateRecord = {
    status: "dismissed",
    dismissed_at: dismissedAt,
    dismiss_reason: reason,
    dismiss_comment: comment,
  };
  storeState(storeId).set(recommendationId, record);
  return record;
}

export function assertRecommendationExists(recommendationId: string): void {
  if (!baseItem(recommendationId)) {
    throw new Error("Recommendation not found");
  }
}

export function getRecommendationBaselineMetrics(recommendationId: string): Record<string, unknown> {
  const item = baseItem(recommendationId);
  if (!item) return {};

  return {
    impact_low_usd: item.impact_low_usd,
    impact_high_usd: item.impact_high_usd,
    category: item.category,
    subject_key: item.subject_key,
    rank_score: item.rank_score,
  };
}

export function newAcceptedAt(now: Date = new Date()): string {
  return now.toISOString();
}

export function newJobId(): string {
  return randomUUID();
}
