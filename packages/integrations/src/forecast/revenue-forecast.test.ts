import { describe, expect, it } from "vitest";
import {
  buildCumulativeForecast,
  computeMape,
  runExponentialSmoothingRevenueForecast,
  shouldDisplayForecastBands,
  shouldRunRevenueForecast,
} from "./revenue-forecast.js";

function buildHistory(days: number, base = 1000): Array<{ day: string; net_revenue: number }> {
  const start = new Date("2025-12-01T00:00:00.000Z");
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return {
      day: date.toISOString().slice(0, 10),
      net_revenue: base + index * 10,
    };
  });
}

describe("revenue forecast helpers", () => {
  it("computes MAPE", () => {
    expect(computeMape([100, 200], [110, 180])).toBeCloseTo(0.1, 1);
  });

  it("builds cumulative bands", () => {
    const cumulative = buildCumulativeForecast([
      { day: "2026-01-01", p10: 100, p50: 120, p90: 140 },
      { day: "2026-01-02", p10: 110, p50: 130, p90: 150 },
    ]);

    expect(cumulative[1]).toMatchObject({ p10: 210, p50: 250, p90: 290 });
  });

  it("hides bands when MAPE is 25% or higher", () => {
    expect(shouldDisplayForecastBands(0.24)).toBe(true);
    expect(shouldDisplayForecastBands(0.25)).toBe(false);
  });

  it("returns insufficient data below 60 days", () => {
    const result = runExponentialSmoothingRevenueForecast(buildHistory(45));
    expect(result.status).toBe("insufficient_data");
    expect(result.message).toContain("60 days");
  });

  it("returns 30-day daily and cumulative bands when history is sufficient", () => {
    const result = runExponentialSmoothingRevenueForecast(buildHistory(120), 30, "2026-03-31");
    expect(result.status).toBe("ready");
    expect(result.daily).toHaveLength(30);
    expect(result.cumulative).toHaveLength(30);
    expect(result.daily[0]?.p50).toBeGreaterThan(0);
  });

  it("runs nightly after configured local time once per day", () => {
    expect(
      shouldRunRevenueForecast({
        timezone: "America/New_York",
        lastForecastDay: null,
        at: new Date("2026-06-17T10:00:00.000Z"),
      }),
    ).toBe(true);

    expect(
      shouldRunRevenueForecast({
        timezone: "America/New_York",
        lastForecastDay: "2026-06-17",
        at: new Date("2026-06-17T12:00:00.000Z"),
      }),
    ).toBe(false);
  });
});
