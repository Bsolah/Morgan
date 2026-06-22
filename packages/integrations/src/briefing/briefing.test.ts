import { describe, expect, it } from "vitest";
import {
  buildAllowedMetricNumbers,
  buildKpiDelta,
  composeTemplateBrief,
  extractNumericTokens,
  formatTopKpiDeltaForPush,
  metricValuesWithinTolerance,
  parseBriefingTimeLocal,
  shouldGenerateDailyBriefing,
  computeNextBriefingAt,
  shouldAllowCriticalBriefRegeneration,
} from "./briefing.js";

describe("briefing scheduler", () => {
  it("parses briefing time local", () => {
    expect(parseBriefingTimeLocal("06:00")).toEqual({ hour: 6, minute: 0 });
    expect(parseBriefingTimeLocal("06:30")).toEqual({ hour: 6, minute: 30 });
  });

  it("generates after configured local time when no brief exists for today", () => {
    const at = new Date("2026-06-17T10:05:00.000Z");
    expect(
      shouldGenerateDailyBriefing({
        timezone: "America/New_York",
        briefingTimeLocal: "06:00",
        lastBriefingDate: null,
        at,
      }),
    ).toBe(true);
  });

  it("skips when brief already generated for merchant-local day", () => {
    const at = new Date("2026-06-17T10:05:00.000Z");
    expect(
      shouldGenerateDailyBriefing({
        timezone: "America/New_York",
        briefingTimeLocal: "06:00",
        lastBriefingDate: "2026-06-17",
        at,
      }),
    ).toBe(false);
  });

  it("computes next briefing datetime in merchant timezone", () => {
    const at = new Date("2026-06-17T08:00:00.000Z");
    const nextAt = computeNextBriefingAt("America/New_York", "06:00", at);
    expect(nextAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    expect(new Date(nextAt).getTime()).toBeGreaterThan(at.getTime());
  });

  it("blocks critical regeneration during quiet hours unless cash runway is below 3 days", () => {
    const at = new Date("2026-06-17T06:00:00.000Z");
    expect(
      shouldAllowCriticalBriefRegeneration({
        timezone: "America/New_York",
        runwayDays: 10,
        at,
      }),
    ).toBe(false);
    expect(
      shouldAllowCriticalBriefRegeneration({
        timezone: "America/New_York",
        runwayDays: 2,
        at,
      }),
    ).toBe(true);
  });

  it("allows critical regeneration outside quiet hours", () => {
    const at = new Date("2026-06-17T14:00:00.000Z");
    expect(
      shouldAllowCriticalBriefRegeneration({
        timezone: "America/New_York",
        runwayDays: 10,
        at,
      }),
    ).toBe(true);
  });
});

describe("briefing narrative validation", () => {
  it("accepts narrative numbers within 0.1% of metric snapshots", () => {
    const kpiDeltas = [
      buildKpiDelta({
        key: "contribution_margin_7d",
        label: "Profit (7d)",
        value: 4280,
        priorValue: 3820,
        format: "currency",
      }),
    ];
    const allowed = buildAllowedMetricNumbers({ contribution_margin_7d: 4280 }, kpiDeltas);
    const narrative = "Contribution profit reached $4,280 this week.";
    expect(metricValuesWithinTolerance(extractNumericTokens(narrative), allowed)).toBe(true);
  });

  it("rejects narrative numbers outside tolerance", () => {
    const allowed = buildAllowedMetricNumbers({ contribution_margin_7d: 4280 }, []);
    const narrative = "Contribution profit reached $5,000 this week.";
    expect(metricValuesWithinTolerance(extractNumericTokens(narrative), allowed)).toBe(false);
  });
});

describe("template brief composer", () => {
  it("builds headline and narrative under limits", () => {
    const output = composeTemplateBrief({
      briefingDate: "2026-06-17",
      metaConnected: true,
      metrics: { contribution_margin_7d: 4280 },
      kpiDeltas: [
        buildKpiDelta({
          key: "contribution_margin_7d",
          label: "Profit (7d)",
          value: 4280,
          priorValue: 3820,
          format: "currency",
        }),
        buildKpiDelta({
          key: "net_revenue_7d",
          label: "Net revenue (7d)",
          value: 12000,
          priorValue: 11000,
          format: "currency",
        }),
        buildKpiDelta({
          key: "mer_7d",
          label: "MER (7d)",
          value: 0.25,
          priorValue: 0.22,
          format: "percent",
        }),
      ],
      topAction: {
        title: "Pause underperforming campaign",
        body: "Campaign X has burned spend with POAS below 1 for seven days.",
        category: "marketing",
        impact_low_usd: 420,
        impact_high_usd: 420,
        source: "profit_leak",
        external_key: "ad_waste:meta:123",
      },
    });

    expect(output.headline.length).toBeLessThanOrEqual(140);
    expect(output.narrative).toContain("4,280");
    expect(output.narrative).toContain("Pause underperforming campaign");
  });
});

describe("formatTopKpiDeltaForPush", () => {
  it("uses the first KPI delta for push body copy", () => {
    expect(
      formatTopKpiDeltaForPush([
        buildKpiDelta({
          key: "contribution_margin_7d",
          label: "Contribution profit (7d)",
          value: 4280,
          priorValue: 3820,
          format: "currency",
        }),
      ]),
    ).toBe("Contribution profit (7d): $4,280 (+12.0% vs prior week)");
  });
});
