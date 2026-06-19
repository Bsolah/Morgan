import { describe, expect, it } from "vitest";
import {
  averageDailyNetOutflow,
  calculateRunwayDays,
  computeCashRunway,
  dailyNetOutflowsForWindow,
  runwayStatusForDays,
} from "./runway.js";

describe("cash runway", () => {
  it("computes average daily net outflow over a trailing window", () => {
    const outflows = dailyNetOutflowsForWindow(
      [
        { date: "2025-06-01", amount: -100 },
        { date: "2025-06-01", amount: 20 },
        { date: "2025-06-02", amount: -50 },
      ],
      "2025-05-04",
      "2025-06-02",
      30,
    );

    expect(averageDailyNetOutflow(outflows)).toBeCloseTo((80 + 50) / 30, 4);
  });

  it("calculates runway days from balance and burn", () => {
    expect(calculateRunwayDays(3000, 100)).toBe(30);
    expect(calculateRunwayDays(3000, 0)).toBeNull();
  });

  it("flags warning and critical runway thresholds", () => {
    expect(runwayStatusForDays(45)).toBe("healthy");
    expect(runwayStatusForDays(20)).toBe("warning");
    expect(runwayStatusForDays(5)).toBe("critical");
  });

  it("computes runway from balance and trailing transactions", () => {
    const transactions = Array.from({ length: 30 }, (_, index) => ({
      date: `2025-05-${String(index + 1).padStart(2, "0")}`,
      amount: -100,
    }));

    const result = computeCashRunway({
      currentBalance: 3000,
      transactions,
      asOfDay: "2025-05-30",
    });

    expect(result.avgDailyNetOutflow).toBe(100);
    expect(result.runwayDays).toBe(30);
    expect(result.status).toBe("healthy");
  });
});
