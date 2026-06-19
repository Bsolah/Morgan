import { describe, expect, it } from "vitest";
import {
  isBriefingQuietHours,
  shouldAllowCriticalBriefRegeneration,
} from "@morgan/integrations";

describe("critical brief regeneration policy", () => {
  it("detects quiet hours between 10pm and 5am merchant local", () => {
    const lateNight = new Date("2026-06-17T06:00:00.000Z");
    expect(isBriefingQuietHours("America/New_York", lateNight, 22, 5)).toBe(true);

    const afternoon = new Date("2026-06-17T18:00:00.000Z");
    expect(isBriefingQuietHours("America/New_York", afternoon, 22, 5)).toBe(false);
  });

  it("allows quiet-hours override when cash runway is below 3 days", () => {
    const lateNight = new Date("2026-06-17T06:00:00.000Z");
    expect(
      shouldAllowCriticalBriefRegeneration({
        timezone: "America/New_York",
        runwayDays: 2,
        at: lateNight,
        quietStartHour: 22,
        quietEndHour: 5,
        criticalCashOverrideDays: 3,
      }),
    ).toBe(true);
  });

  it("blocks quiet-hours regeneration when cash runway is healthy", () => {
    const lateNight = new Date("2026-06-17T06:00:00.000Z");
    expect(
      shouldAllowCriticalBriefRegeneration({
        timezone: "America/New_York",
        runwayDays: 10,
        at: lateNight,
        quietStartHour: 22,
        quietEndHour: 5,
        criticalCashOverrideDays: 3,
      }),
    ).toBe(false);
  });
});
