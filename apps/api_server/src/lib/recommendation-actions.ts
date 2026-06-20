import {
  assertRecommendationExists,
  applyRecommendationState,
  getRecommendationBaselineMetrics,
  getRecommendationState,
  markRecommendationAccepted,
  markRecommendationDismissed,
  newAcceptedAt,
} from "./recommendation-state.js";
import {
  enqueueOutcomeTrackingJob,
  findOutcomeJobForRecommendation,
} from "./recommendation-outcome-jobs.js";
import {
  enqueueRankingFeedback,
  findRankingFeedbackForRecommendation,
} from "./recommendation-ranking-feedback.js";
import {
  recordDismissalSuppression,
  type DismissReason,
} from "./recommendation-suppression.js";
import type { RecommendationItem } from "./recommendations-data.js";
import { SAMPLE_OPEN } from "./recommendations-data.js";

export type AcceptRecommendationResult = {
  id: string;
  status: "accepted";
  accepted_at: string;
  outcome_job_id: string;
};

export type DismissRecommendationResult = {
  id: string;
  status: "dismissed";
  dismissed_at: string;
  reason: DismissReason;
  feedback_event_id: string;
};

export function dismissRecommendation(
  storeId: string,
  recommendationId: string,
  input: { reason: DismissReason; comment?: string },
  now: Date = new Date(),
): DismissRecommendationResult {
  assertRecommendationExists(recommendationId);
  const item = getSampleItem(recommendationId);
  if (!item) {
    throw new Error("Recommendation not found");
  }

  const existing = getRecommendationState(storeId, recommendationId);
  if (existing?.status === "dismissed" && existing.dismissed_at) {
    const feedback = findRankingFeedbackForRecommendation(storeId, recommendationId);
    return {
      id: recommendationId,
      status: "dismissed",
      dismissed_at: existing.dismissed_at,
      reason: (existing.dismiss_reason ?? input.reason) as DismissReason,
      feedback_event_id: feedback?.event_id ?? "",
    };
  }

  const dismissedAt = newAcceptedAt(now);
  markRecommendationDismissed(
    storeId,
    recommendationId,
    dismissedAt,
    input.reason,
    input.comment,
  );

  recordDismissalSuppression({
    store_id: storeId,
    category: item.category,
    subject_key: item.subject_key,
    dismissed_at: dismissedAt,
    reason: input.reason,
    comment: input.comment,
    source_recommendation_id: recommendationId,
  });

  const feedback = enqueueRankingFeedback({
    store_id: storeId,
    recommendation_id: recommendationId,
    dismissed_at: dismissedAt,
    reason: input.reason,
    comment: input.comment,
    category: item.category,
    subject_key: item.subject_key,
  });

  return {
    id: recommendationId,
    status: "dismissed",
    dismissed_at: dismissedAt,
    reason: input.reason,
    feedback_event_id: feedback.event_id,
  };
}

export function acceptRecommendation(
  storeId: string,
  recommendationId: string,
  now: Date = new Date(),
): AcceptRecommendationResult {
  assertRecommendationExists(recommendationId);

  const existing = getRecommendationState(storeId, recommendationId);
  if (existing?.status === "accepted" && existing.accepted_at) {
    const job = findOutcomeJobForRecommendation(storeId, recommendationId);
    return {
      id: recommendationId,
      status: "accepted",
      accepted_at: existing.accepted_at,
      outcome_job_id: job?.job_id ?? "",
    };
  }

  const acceptedAt = newAcceptedAt(now);
  markRecommendationAccepted(storeId, recommendationId, acceptedAt);

  const job = enqueueOutcomeTrackingJob({
    store_id: storeId,
    recommendation_id: recommendationId,
    accepted_at: acceptedAt,
    baseline_metrics: getRecommendationBaselineMetrics(recommendationId),
  });

  return {
    id: recommendationId,
    status: "accepted",
    accepted_at: acceptedAt,
    outcome_job_id: job.job_id,
  };
}

export function withRecommendationStatus(
  storeId: string,
  item: Omit<RecommendationItem, "rank" | "status" | "accepted_at">,
  rank: number,
): RecommendationItem {
  return applyRecommendationState(storeId, item, rank);
}

export function getSampleItem(recommendationId: string) {
  return SAMPLE_OPEN.find((item) => item.id === recommendationId);
}
