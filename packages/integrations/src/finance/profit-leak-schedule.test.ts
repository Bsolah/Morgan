import { describe, expect, it } from "vitest";
import { shouldRunProfitLeakScan } from "./profit-leak-schedule.js";

describe("shouldRunProfitLeakScan", () => {
  it("returns false before 05:30 merchant-local", () => {
    expect(
      shouldRunProfitLeakScan({
        timezone: "America/New_York",
        lastScanDay: null,
        at: new Date("2026-06-17T09:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("returns true at 05:30 merchant-local when not yet scanned today", () => {
    expect(
      shouldRunProfitLeakScan({
        timezone: "America/New_York",
        lastScanDay: null,
        at: new Date("2026-06-17T09:30:00.000Z"),
      }),
    ).toBe(true);
  });

  it("returns false when already scanned today", () => {
    expect(
      shouldRunProfitLeakScan({
        timezone: "America/New_York",
        lastScanDay: "2026-06-17",
        at: new Date("2026-06-17T10:00:00.000Z"),
      }),
    ).toBe(false);
  });
});
