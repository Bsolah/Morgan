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
  it("projects profit and cash ranges with assumptions", () => {
    const result = runAdSpendScenarioForecast({
      channel: "meta",
      spendChangePct: 20,
      baselineSpend7dUsd: 2000,
      poas7d: 1.2,
      runwayDays: 45,
      avgDailyNetOutflow: 500,
      referenceDay: "2026-06-16",
    });

    expect(result).not.toBeNull();
    expect(result!.profit_change_low_usd).toBeLessThan(result!.profit_change_high_usd);
    expect(result!.assumptions[0]).toContain("Assumes current POAS");
    expect(result!.confidence).toBe("high");
  });
});
