import { describe, expect, it, beforeEach } from "vitest";
import { dismissRecommendation } from "./recommendation-actions.js";
import {
  findRankingFeedbackForRecommendation,
  getRankingFeedbackEvents,
  resetRankingFeedbackEvents,
} from "./recommendation-ranking-feedback.js";
import { resetRecommendationState } from "./recommendation-state.js";
import {
  getDismissalSuppressions,
  isSubjectSuppressed,
  resetDismissalSuppressions,
} from "./recommendation-suppression.js";
import { getStoreRecommendations } from "./recommendations-feed.js";

describe("dismissRecommendation", () => {
  beforeEach(() => {
    resetRecommendationState();
    resetDismissalSuppressions();
    resetRankingFeedbackEvents();
  });

  it("requires reason and records dismissed_at", () => {
    const result = dismissRecommendation("store-1", "rec-001", {
      reason: "not_relevant",
    });

    expect(result.status).toBe("dismissed");
    expect(result.reason).toBe("not_relevant");
    expect(result.dismissed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.feedback_event_id).toBeTruthy();
  });

  it("removes dismissed item from open feed", () => {
    dismissRecommendation("store-1", "rec-001", { reason: "disagree" });
    const feed = getStoreRecommendations("store-1");

    expect(feed.open.some((item) => item.id === "rec-001")).toBe(false);
  });

  it("suppresses similar category + subject for 14 days", () => {
    dismissRecommendation("store-1", "rec-001", { reason: "already_done" });
    const feed = getStoreRecommendations("store-1");

    expect(feed.open.some((item) => item.id === "rec-006")).toBe(false);
    expect(feed.open.some((item) => item.id === "rec-004")).toBe(true);
    expect(isSubjectSuppressed("store-1", "ad_waste", "meta_campaign_x")).toBe(true);
    expect(getDismissalSuppressions("store-1")).toHaveLength(1);
  });

  it("enqueues ranking model feedback with optional comment", () => {
    const result = dismissRecommendation("store-1", "rec-002", {
      reason: "other",
      comment: "We reorder through our 3PL automatically",
    });

    const feedback = findRankingFeedbackForRecommendation("store-1", "rec-002");
    expect(result.feedback_event_id).toBe(feedback?.event_id);
    expect(feedback).toMatchObject({
      reason: "other",
      comment: "We reorder through our 3PL automatically",
      category: "inventory",
      subject_key: "sku_blue_tee_m",
    });
    expect(getRankingFeedbackEvents()).toHaveLength(1);
  });
});
