import { describe, expect, it } from "vitest";
import {
  computeNextBriefingDelivery,
  nextScheduleEffectiveFromDay,
  resolveSchedulerBriefingSchedule,
} from "./schedule.js";

describe("briefing schedule", () => {
  it("computes next calendar day as effective-from date", () => {
    expect(
      nextScheduleEffectiveFromDay("America/New_York", new Date("2026-06-17T14:00:00.000Z")),
    ).toBe("2026-06-18");
  });

  it("keeps current schedule until effective-from day", () => {
    expect(
      resolveSchedulerBriefingSchedule({
        timezone: "America/New_York",
        briefingTimeLocal: "06:00",
        pendingTimezone: "America/New_York",
        pendingBriefingTimeLocal: "07:00",
        scheduleEffectiveFrom: "2026-06-18",
        at: new Date("2026-06-17T14:00:00.000Z"),
      }),
    ).toEqual({
      timezone: "America/New_York",
      briefingTimeLocal: "06:00",
    });
  });

  it("uses pending schedule on effective-from day", () => {
    expect(
      resolveSchedulerBriefingSchedule({
        timezone: "America/New_York",
        briefingTimeLocal: "06:00",
        pendingTimezone: "America/New_York",
        pendingBriefingTimeLocal: "07:00",
        scheduleEffectiveFrom: "2026-06-18",
        at: new Date("2026-06-18T10:00:00.000Z"),
      }),
    ).toEqual({
      timezone: "America/New_York",
      briefingTimeLocal: "07:00",
    });
  });

  it("delivers today at current time when pending starts tomorrow and current time not passed", () => {
    const nextAt = computeNextBriefingDelivery({
      timezone: "America/New_York",
      briefingTimeLocal: "06:00",
      pendingTimezone: "America/New_York",
      pendingBriefingTimeLocal: "07:00",
      scheduleEffectiveFrom: "2026-06-18",
      at: new Date("2026-06-17T08:00:00.000Z"),
    });

    const nextLocal = new Date(nextAt);
    expect(nextLocal.getTime()).toBeGreaterThan(new Date("2026-06-17T08:00:00.000Z").getTime());
  });

  it("uses pending schedule for next delivery after today's brief has passed", () => {
    const nextAt = computeNextBriefingDelivery({
      timezone: "America/New_York",
      briefingTimeLocal: "06:00",
      pendingTimezone: "America/New_York",
      pendingBriefingTimeLocal: "07:00",
      scheduleEffectiveFrom: "2026-06-18",
      at: new Date("2026-06-17T14:00:00.000Z"),
    });

    expect(new Date(nextAt).getTime()).toBeGreaterThan(new Date("2026-06-17T14:00:00.000Z").getTime());
  });
});
