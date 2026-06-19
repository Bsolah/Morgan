import { describe, expect, it } from "vitest";
import { generateChatStarters } from "./chat-starters.js";

describe("generateChatStarters", () => {
  it("builds margin drop starter from brief headline", () => {
    const starters = generateChatStarters({
      headline: "Margin down on higher refunds — Meta POAS slipped.",
    });

    expect(starters.length).toBeGreaterThanOrEqual(3);
    expect(starters[0]).toMatchObject({
      label: "Why did margin drop?",
      message: "Why did margin drop yesterday?",
      source: "brief_headline",
    });
  });

  it("prioritizes critical alerts before defaults", () => {
    const starters = generateChatStarters({
      alerts: [
        {
          type: "cash_runway_critical",
          title: "Cash runway below 7 days",
          severity: "critical",
        },
      ],
    });

    expect(starters[0]).toMatchObject({
      label: "Cash runway?",
      source: "alert",
    });
    expect(starters.length).toBeGreaterThanOrEqual(3);
  });

  it("uses KPI deltas when margin is down", () => {
    const starters = generateChatStarters({
      kpiDeltas: [
        {
          key: "contribution_margin_7d",
          label: "Contribution profit",
          value: 3600,
          prior_value: 4200,
          delta_pct: -14.3,
          direction: "down",
          format: "currency",
        },
      ],
    });

    expect(starters.some((starter) => starter.message.includes("margin drop"))).toBe(true);
    expect(starters.length).toBeGreaterThanOrEqual(3);
  });

  it("dedupes starters by message", () => {
    const starters = generateChatStarters({
      headline: "Profit down after ad spend increased",
      alerts: [
        {
          type: "custom",
          title: "Profit down 12%",
          severity: "warning",
        },
      ],
    });

    const messages = starters.map((starter) => starter.message.toLowerCase());
    expect(new Set(messages).size).toBe(messages.length);
  });
});
