import type { RecommendationCategory } from "./recommendations-data.js";

export type DismissReason = "not_relevant" | "already_done" | "disagree" | "other";

export type DismissalSuppressionRecord = {
  category: RecommendationCategory;
  subject_key: string;
  dismissed_at: string;
  reason: DismissReason;
  comment?: string;
  source_recommendation_id: string;
};

const SUPPRESSION_DAYS = 14;
const suppressionsByStore = new Map<string, DismissalSuppressionRecord[]>();

export function resetDismissalSuppressions(): void {
  suppressionsByStore.clear();
}

export function recordDismissalSuppression(input: {
  store_id: string;
  category: RecommendationCategory;
  subject_key: string;
  dismissed_at: string;
  reason: DismissReason;
  comment?: string;
  source_recommendation_id: string;
}): DismissalSuppressionRecord {
  const record: DismissalSuppressionRecord = {
    category: input.category,
    subject_key: input.subject_key,
    dismissed_at: input.dismissed_at,
    reason: input.reason,
    comment: input.comment,
    source_recommendation_id: input.source_recommendation_id,
  };

  const existing = suppressionsByStore.get(input.store_id) ?? [];
  existing.push(record);
  suppressionsByStore.set(input.store_id, existing);
  return record;
}

export function getDismissalSuppressions(storeId: string): DismissalSuppressionRecord[] {
  return [...(suppressionsByStore.get(storeId) ?? [])];
}

export function isSubjectSuppressed(
  storeId: string,
  category: RecommendationCategory,
  subjectKey: string,
  now: Date = new Date(),
): boolean {
  const cutoff = now.getTime() - SUPPRESSION_DAYS * 24 * 60 * 60 * 1000;
  return (suppressionsByStore.get(storeId) ?? []).some(
    (record) =>
      record.category === category &&
      record.subject_key === subjectKey &&
      new Date(record.dismissed_at).getTime() >= cutoff,
  );
}

export const SUPPRESSION_WINDOW_DAYS = SUPPRESSION_DAYS;
