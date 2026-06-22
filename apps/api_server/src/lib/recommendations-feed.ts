import { withRecommendationStatus } from "./recommendation-actions.js";
import { getRecommendationState } from "./recommendation-state.js";
import { isSubjectSuppressed } from "./recommendation-suppression.js";
import {
  SAMPLE_OPEN,
  type RecommendationItem,
  type RecommendationsResponse,
} from "./recommendations-data.js";

const ARCHIVED_COUNT = 4;
const MAX_OPEN = 5;

/** Rank and cap open recommendations until mart_recommendations is wired. */
export function getStoreRecommendations(storeId: string): RecommendationsResponse {
  const sorted = [...SAMPLE_OPEN].sort((a, b) => b.rank_score - a.rank_score);

  const accepted: RecommendationItem[] = [];
  const openCandidates: RecommendationItem[] = [];
  let dismissedCount = 0;
  let suppressedCount = 0;

  for (const item of sorted) {
    const state = getRecommendationState(storeId, item.id);
    const withStatus = withRecommendationStatus(storeId, item, 0);

    if (state?.status === "dismissed") {
      dismissedCount += 1;
      continue;
    }

    if (state?.status === "accepted") {
      accepted.push(withStatus);
      continue;
    }

    if (isSubjectSuppressed(storeId, item.category, item.subject_key)) {
      suppressedCount += 1;
      continue;
    }

    openCandidates.push(withStatus);
  }

  const open = openCandidates.slice(0, MAX_OPEN).map((item, index) => ({
    ...item,
    rank: index + 1,
  }));

  const in_progress = accepted
    .sort(
      (a, b) =>
        new Date(b.accepted_at ?? 0).getTime() - new Date(a.accepted_at ?? 0).getTime(),
    )
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  return {
    open,
    in_progress,
    archived_count: ARCHIVED_COUNT + dismissedCount + suppressedCount,
  };
}

export function getEmptyRecommendations(): RecommendationsResponse {
  return { open: [], in_progress: [], archived_count: 0 };
}
