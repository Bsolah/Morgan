import { describe, expect, it } from "vitest";
import { runAdSpendScenarioForecast } from "./ad-spend-scenario.js";
import { parseScenarioIntent } from "./scenario-intent.js";

describe("parseScenarioIntent", () => {
  it("parses Meta spend increase", () => {
    expect(parseScenarioIntent("What if I increase Meta spend 20%?")).toEqual({
      channel: "meta",
      spendChangePct: 20,
    });
  });

  it("parses spend decrease", () => {
    expect(parseScenarioIntent("What happens if I decrease Meta ad spend by 15%?")).toEqual({
      channel: "meta",
      spendChangePct: -15,
    });
  });

  it("returns null for non-scenario prompts", () => {
    expect(parseScenarioIntent("Why did profit drop yesterday?")).toBeNull();
  });
});

describe("runAdSpendScenarioForecast", () => {
  it("projects revenue, profit, cash, and runway ranges with editable assumptions", () => {
    const result = runAdSpendScenarioForecast({
      channel: "meta",
      spendChangePct: 20,
      baselineSpend7dUsd: 2000,
      baselineRevenue7dUsd: 5000,
      poas7d: 1.2,
      runwayDays: 45,
      avgDailyNetOutflow: 500,
      referenceDay: "2026-06-16",
    });

    expect(result).not.toBeNull();
    expect(result!.revenue_change_low_usd).toBeLessThan(result!.revenue_change_high_usd);
    expect(result!.profit_change_low_usd).toBeLessThan(result!.profit_change_high_usd);
    expect(result!.runway_days_delta_low).not.toBeNull();
    expect(result!.assumption_items.length).toBeGreaterThan(0);
    expect(result!.assumptions[0]).toContain("POAS");
  });

  it("applies assumption overrides", () => {
    const result = runAdSpendScenarioForecast({
      channel: "meta",
      spendChangePct: 10,
      baselineSpend7dUsd: 1000,
      baselineRevenue7dUsd: 2500,
      poas7d: 1.1,
      runwayDays: 30,
      avgDailyNetOutflow: 400,
      referenceDay: "2026-06-16",
      assumptionOverrides: { poas_7d: 2, confidence_band_pct: 5 },
    });

    expect(result!.assumption_items.find((item) => item.key === "poas_7d")?.value).toBe(2);
    expect(result!.confidence_band_pct).toBe(5);
  });
});
