import { describe, expect, it } from "vitest";
import {
  formatMarginTrend,
  formatWeekLabel,
  merchantWeekdayIso,
  shouldSendWeeklyEmailDigest,
  weekStartMondayFromLocalDay,
} from "./weekly-email-digest.js";

describe("weekly email digest scheduler", () => {
  it("detects Monday in merchant timezone", () => {
    const at = new Date("2026-06-15T11:00:00.000Z");
    expect(merchantWeekdayIso("America/New_York", at)).toBe(1);
  });

  it("finds Monday week start from a mid-week local day", () => {
    expect(weekStartMondayFromLocalDay("2026-06-17", "America/New_York")).toBe("2026-06-15");
  });

  it("sends after 7am local on Monday when not yet sent this week", () => {
    const at = new Date("2026-06-15T11:30:00.000Z");
    expect(
      shouldSendWeeklyEmailDigest({
        timezone: "America/New_York",
        digestTimeLocal: "07:00",
        lastSentWeekStart: null,
        at,
      }),
    ).toBe(true);
  });

  it("skips when digest already sent for the week", () => {
    const at = new Date("2026-06-15T11:30:00.000Z");
    expect(
      shouldSendWeeklyEmailDigest({
        timezone: "America/New_York",
        digestTimeLocal: "07:00",
        lastSentWeekStart: "2026-06-15",
        at,
      }),
    ).toBe(false);
  });

  it("skips before 7am local on Monday", () => {
    const at = new Date("2026-06-15T09:00:00.000Z");
    expect(
      shouldSendWeeklyEmailDigest({
        timezone: "America/New_York",
        digestTimeLocal: "07:00",
        lastSentWeekStart: null,
        at,
      }),
    ).toBe(false);
  });

  it("formats week label", () => {
    expect(formatWeekLabel("2026-06-15", "UTC")).toContain("Jun");
  });

  it("formats margin trend with delta", () => {
    expect(
      formatMarginTrend({ currentMarginPct: 41.2, marginDeltaPct: 2.1 }),
    ).toBe("41.2% (+2.1 pts vs prior week)");
  });
});
