import { randomUUID } from "node:crypto";
import type { DismissReason } from "./recommendation-suppression.js";
import type { RecommendationCategory } from "./recommendations-data.js";

export type RankingFeedbackEvent = {
  event_id: string;
  store_id: string;
  recommendation_id: string;
  dismissed_at: string;
  reason: DismissReason;
  comment?: string;
  category: RecommendationCategory;
  subject_key: string;
};

const feedbackEvents: RankingFeedbackEvent[] = [];

/** Ranking model feedback — accept/dismiss signals for bandit retraining. */
export function enqueueRankingFeedback(input: {
  store_id: string;
  recommendation_id: string;
  dismissed_at: string;
  reason: DismissReason;
  comment?: string;
  category: RecommendationCategory;
  subject_key: string;
}): RankingFeedbackEvent {
  const event: RankingFeedbackEvent = {
    event_id: randomUUID(),
    store_id: input.store_id,
    recommendation_id: input.recommendation_id,
    dismissed_at: input.dismissed_at,
    reason: input.reason,
    comment: input.comment,
    category: input.category,
    subject_key: input.subject_key,
  };
  feedbackEvents.push(event);
  return event;
}

export function getRankingFeedbackEvents(): RankingFeedbackEvent[] {
  return [...feedbackEvents];
}

export function resetRankingFeedbackEvents(): void {
  feedbackEvents.length = 0;
}

export function findRankingFeedbackForRecommendation(
  storeId: string,
  recommendationId: string,
): RankingFeedbackEvent | undefined {
  return feedbackEvents.find(
    (event) => event.store_id === storeId && event.recommendation_id === recommendationId,
  );
}
