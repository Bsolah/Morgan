import { describe, expect, it } from "vitest";
import {
  buildCumulativeForecast,
  computeMape,
  runExponentialSmoothingRevenueForecast,
  shouldDisplayForecastBands,
} from "@morgan/integrations";

describe("revenue forecast model", () => {
  it("tracks MAPE and hides bands at 25% or above", () => {
    const mape = computeMape([100, 200, 150], [90, 210, 140]);
    expect(mape).not.toBeNull();
    expect(shouldDisplayForecastBands(0.24)).toBe(true);
    expect(shouldDisplayForecastBands(0.25)).toBe(false);
  });

  it("produces cumulative totals from daily quantiles", () => {
    const cumulative = buildCumulativeForecast([
      { day: "2026-04-01", p10: 100, p50: 120, p90: 140 },
      { day: "2026-04-02", p10: 110, p50: 130, p90: 150 },
    ]);

    expect(cumulative[1]?.p50).toBe(250);
  });

  it("returns insufficient data below 60 days of history", () => {
    const history = Array.from({ length: 45 }, (_, index) => ({
      day: `2026-01-${String(index + 1).padStart(2, "0")}`,
      net_revenue: 1000 + index * 5,
    }));

    const result = runExponentialSmoothingRevenueForecast(history, 30, "2026-02-15");
    expect(result.status).toBe("insufficient_data");
    expect(result.message).toContain("60 days");
  });

  it("returns 30-day daily and cumulative output when trained on 90+ days", () => {
    const history = Array.from({ length: 100 }, (_, index) => {
      const date = new Date("2025-12-01T00:00:00.000Z");
      date.setUTCDate(date.getUTCDate() + index);
      return {
        day: date.toISOString().slice(0, 10),
        net_revenue: 900 + index * 12,
      };
    });

    const result = runExponentialSmoothingRevenueForecast(history, 30, "2026-03-10");
    expect(result.status).toBe("ready");
    expect(result.daily).toHaveLength(30);
    expect(result.cumulative).toHaveLength(30);
    expect(result.mape).not.toBeNull();
  });
});
