import { describe, expect, it } from "vitest";
import { buildDailyCashFlowBreakdown } from "./cash-flow-breakdown.js";

describe("buildDailyCashFlowBreakdown", () => {
  it("aggregates inflows and outflows by day over a trailing window", () => {
    const breakdown = buildDailyCashFlowBreakdown(
      [
        { date: "2026-06-15", amount: 500 },
        { date: "2026-06-15", amount: -120 },
        { date: "2026-06-16", amount: -80 },
      ],
      "2026-06-16",
      3,
    );

    expect(breakdown).toHaveLength(3);
    expect(breakdown[1]).toMatchObject({
      day: "2026-06-15",
      inflows_usd: 500,
      outflows_usd: 120,
    });
    expect(breakdown[2]).toMatchObject({
      day: "2026-06-16",
      inflows_usd: 0,
      outflows_usd: 80,
    });
  });
});
