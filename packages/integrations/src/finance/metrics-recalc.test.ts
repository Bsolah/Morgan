import { describe, expect, it } from "vitest";
import { resolveMetricsRecalculationState } from "./metrics-recalc.js";

describe("resolveMetricsRecalculationState", () => {
  const now = new Date("2026-06-17T12:00:00.000Z");

  it("returns idle when no recalculation was requested", () => {
    expect(
      resolveMetricsRecalculationState({
        requestedAt: null,
        startedAt: null,
        completedAt: null,
        dueBy: null,
        now,
      }),
    ).toMatchObject({ status: "idle" });
  });

  it("returns scheduled when requested but not started", () => {
    expect(
      resolveMetricsRecalculationState({
        requestedAt: new Date("2026-06-17T11:59:00.000Z"),
        startedAt: null,
        completedAt: null,
        dueBy: new Date("2026-06-17T12:59:00.000Z"),
        now,
      }),
    ).toMatchObject({ status: "scheduled" });
  });

  it("returns in_progress when started but not completed", () => {
    expect(
      resolveMetricsRecalculationState({
        requestedAt: new Date("2026-06-17T11:59:00.000Z"),
        startedAt: new Date("2026-06-17T11:59:30.000Z"),
        completedAt: null,
        dueBy: new Date("2026-06-17T12:59:00.000Z"),
        now,
      }),
    ).toMatchObject({ status: "in_progress" });
  });

  it("returns completed shortly after finishing", () => {
    expect(
      resolveMetricsRecalculationState({
        requestedAt: new Date("2026-06-17T11:59:00.000Z"),
        startedAt: new Date("2026-06-17T11:59:30.000Z"),
        completedAt: new Date("2026-06-17T11:59:45.000Z"),
        dueBy: new Date("2026-06-17T12:59:00.000Z"),
        now,
      }),
    ).toMatchObject({ status: "completed" });
  });

  it("returns idle after completion window expires", () => {
    expect(
      resolveMetricsRecalculationState({
        requestedAt: new Date("2026-06-17T10:00:00.000Z"),
        startedAt: new Date("2026-06-17T10:00:10.000Z"),
        completedAt: new Date("2026-06-17T10:01:00.000Z"),
        dueBy: new Date("2026-06-17T11:00:00.000Z"),
        now,
      }),
    ).toMatchObject({ status: "idle" });
  });
});
