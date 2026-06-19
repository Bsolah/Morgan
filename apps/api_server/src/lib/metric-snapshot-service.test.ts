import { describe, expect, it } from "vitest";
import { METRIC_SNAPSHOT_STALE_HOURS } from "./metric-snapshot-service.js";

describe("metric snapshot constants", () => {
  it("marks snapshots stale after 6 hours", () => {
    expect(METRIC_SNAPSHOT_STALE_HOURS).toBe(6);
  });

  it("computes staleness from snapshots_as_of", () => {
    const staleMs = METRIC_SNAPSHOT_STALE_HOURS * 60 * 60 * 1000;
    const freshAsOf = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const staleAsOf = new Date(Date.now() - 7 * 60 * 60 * 1000);

    expect(Date.now() - freshAsOf.getTime() > staleMs).toBe(false);
    expect(Date.now() - staleAsOf.getTime() > staleMs).toBe(true);
  });
});
