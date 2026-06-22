export type MetricsRecalculationStatus = "idle" | "scheduled" | "in_progress" | "completed";

export type MetricsRecalculationView = {
  status: MetricsRecalculationStatus;
  requested_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  due_by: string | null;
};

const COMPLETION_VISIBLE_MS = 10 * 60 * 1000;

export function resolveMetricsRecalculationState(input: {
  requestedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  dueBy: Date | null;
  now?: Date;
}): MetricsRecalculationView {
  const now = input.now ?? new Date();
  const requestedAt = input.requestedAt?.toISOString() ?? null;
  const startedAt = input.startedAt?.toISOString() ?? null;
  const completedAt = input.completedAt?.toISOString() ?? null;
  const dueBy = input.dueBy?.toISOString() ?? null;

  if (!input.requestedAt) {
    return {
      status: "idle",
      requested_at: null,
      started_at: null,
      completed_at: null,
      due_by: null,
    };
  }

  const completedAfterRequest =
    input.completedAt != null && input.completedAt.getTime() >= input.requestedAt.getTime();

  if (completedAfterRequest) {
    const recentlyCompleted = now.getTime() - input.completedAt!.getTime() <= COMPLETION_VISIBLE_MS;
    return {
      status: recentlyCompleted ? "completed" : "idle",
      requested_at: requestedAt,
      started_at: startedAt,
      completed_at: completedAt,
      due_by: dueBy,
    };
  }

  if (input.startedAt) {
    return {
      status: "in_progress",
      requested_at: requestedAt,
      started_at: startedAt,
      completed_at: null,
      due_by: dueBy,
    };
  }

  return {
    status: "scheduled",
    requested_at: requestedAt,
    started_at: null,
    completed_at: null,
    due_by: dueBy,
  };
}
