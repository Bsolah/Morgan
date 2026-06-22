import { randomUUID } from "node:crypto";

export type OutcomeTrackingJob = {
  job_id: string;
  store_id: string;
  recommendation_id: string;
  accepted_at: string;
  measurement_windows_days: number[];
  baseline_metrics: Record<string, unknown>;
};

const jobQueue: OutcomeTrackingJob[] = [];

/** EPIC-33: enqueue 7/14/30-day outcome measurement after accept. */
export function enqueueOutcomeTrackingJob(input: {
  store_id: string;
  recommendation_id: string;
  accepted_at: string;
  baseline_metrics: Record<string, unknown>;
}): OutcomeTrackingJob {
  const job: OutcomeTrackingJob = {
    job_id: randomUUID(),
    store_id: input.store_id,
    recommendation_id: input.recommendation_id,
    accepted_at: input.accepted_at,
    measurement_windows_days: [7, 14, 30],
    baseline_metrics: input.baseline_metrics,
  };
  jobQueue.push(job);
  return job;
}

export function getOutcomeTrackingJobs(): OutcomeTrackingJob[] {
  return [...jobQueue];
}

export function resetOutcomeTrackingJobs(): void {
  jobQueue.length = 0;
}

export function findOutcomeJobForRecommendation(
  storeId: string,
  recommendationId: string,
): OutcomeTrackingJob | undefined {
  return jobQueue.find(
    (job) => job.store_id === storeId && job.recommendation_id === recommendationId,
  );
}
