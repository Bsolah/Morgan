import { describe, expect, it, beforeEach } from "vitest";
import { acceptRecommendation } from "./recommendation-actions.js";
import {
  findOutcomeJobForRecommendation,
  getOutcomeTrackingJobs,
  resetOutcomeTrackingJobs,
} from "./recommendation-outcome-jobs.js";
import { resetRecommendationState } from "./recommendation-state.js";
import { getStoreRecommendations } from "./recommendations-feed.js";

describe("acceptRecommendation", () => {
  beforeEach(() => {
    resetRecommendationState();
    resetOutcomeTrackingJobs();
  });

  it("sets status accepted with accepted_at timestamp", () => {
    const result = acceptRecommendation("store-1", "rec-001");
    expect(result.status).toBe("accepted");
    expect(result.accepted_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("moves recommendation from open to in_progress feed", () => {
    acceptRecommendation("store-1", "rec-001");
    const feed = getStoreRecommendations("store-1");

    expect(feed.open.some((item) => item.id === "rec-001")).toBe(false);
    expect(feed.in_progress.some((item) => item.id === "rec-001")).toBe(true);
    expect(feed.in_progress[0]?.status).toBe("accepted");
    expect(feed.in_progress[0]?.accepted_at).toBeTruthy();
  });

  it("enqueues outcome tracking job with 7/14/30 day windows", () => {
    const result = acceptRecommendation("store-1", "rec-001");
    const job = findOutcomeJobForRecommendation("store-1", "rec-001");

    expect(result.outcome_job_id).toBe(job?.job_id);
    expect(job?.measurement_windows_days).toEqual([7, 14, 30]);
    expect(job?.baseline_metrics).toMatchObject({
      impact_low_usd: 350,
      category: "ad_waste",
    });
    expect(getOutcomeTrackingJobs()).toHaveLength(1);
  });
});
