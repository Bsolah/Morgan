import { describe, expect, it } from "vitest";
import { computeSyncStatus } from "./sync-status.js";

describe("computeSyncStatus", () => {
  it("starts at zero progress", () => {
    const now = new Date("2026-06-15T12:00:00Z");
    const status = computeSyncStatus({
      storeId: "store-1",
      storeStatus: "syncing",
      startedAt: now,
      now,
    });

    expect(status.overall_percent).toBe(0);
    expect(status.tasks.every((t) => t.percent === 0)).toBe(true);
    expect(status.eta_minutes).toBeGreaterThan(0);
  });

  it("reaches high progress after elapsed time", () => {
    const startedAt = new Date("2026-06-15T12:00:00Z");
    const now = new Date("2026-06-15T12:03:00Z");
    const status = computeSyncStatus({
      storeId: "store-1",
      storeStatus: "syncing",
      startedAt,
      now,
    });

    expect(status.overall_percent).toBeGreaterThan(50);
    expect(status.tasks[0]?.id).toBe("orders");
  });
});
