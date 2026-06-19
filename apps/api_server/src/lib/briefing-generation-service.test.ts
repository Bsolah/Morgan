import { describe, expect, it, vi } from "vitest";
import {
  buildAllowedMetricNumbers,
  buildKpiDelta,
  composeTemplateBrief,
  extractNumericTokens,
  metricValuesWithinTolerance,
} from "@morgan/integrations";

vi.mock("./briefing-llm-client.js", () => ({
  generateBriefingNarrative: vi.fn(async (context: Parameters<typeof composeTemplateBrief>[0] & {
    allowedNumbers: number[];
  }) => ({
    output: composeTemplateBrief(context),
    source: "template" as const,
  })),
}));

describe("briefing generation narrative guardrails", () => {
  it("template narrative numbers stay within metric snapshot tolerance", () => {
    const kpiDeltas = [
      buildKpiDelta({
        key: "contribution_margin_7d",
        label: "Contribution profit (7d)",
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
    ];

    const metrics = {
      contribution_margin_7d: 4280,
      net_revenue_7d: 12000,
      mer_7d: 0.25,
    };
    const allowed = buildAllowedMetricNumbers(metrics, kpiDeltas);
    const output = composeTemplateBrief({
      briefingDate: "2026-06-17",
      kpiDeltas,
      topAction: {
        title: "Pause underperforming campaign",
        body: "Campaign X has burned spend with POAS below 1 for seven days.",
        category: "marketing",
        impact_low_usd: 420,
        impact_high_usd: 420,
        source: "profit_leak",
        external_key: "123",
      },
      metaConnected: true,
      metrics,
    });

    expect(
      metricValuesWithinTolerance(extractNumericTokens(output.narrative), allowed),
    ).toBe(true);
  });
});
