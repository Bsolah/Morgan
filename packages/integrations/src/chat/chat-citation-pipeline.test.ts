import { describe, expect, it } from "vitest";
import { enforceChatCitationGuardrail } from "./chat-citation-guardrail.js";
import { enrichChatSynthesisResult } from "./chat-citations.js";
import { synthesizeChatResponse, type ChatDataContext } from "./chat-synthesis.js";

const context: ChatDataContext = {
  intent: { type: "profit_change", focus: "yesterday" },
  timezone: "UTC",
  referenceDay: "2026-06-16",
  profitSeries: [
    { day: "2026-06-15", contribution_margin: 4200, net_revenue: 12000 },
    { day: "2026-06-16", contribution_margin: 3600, net_revenue: 11000 },
  ],
  runwayDays: 38,
  adSpend7d: 1800,
};

describe("chat citation pipeline", () => {
  it("passes guardrail for enriched profit synthesis", () => {
    const enriched = enrichChatSynthesisResult(synthesizeChatResponse(context), context);
    const guarded = enforceChatCitationGuardrail(enriched);

    expect(guarded.answer).toContain("3,600");
    expect(guarded.citations.length).toBeGreaterThanOrEqual(1);
    expect(guarded.citations[0]).toMatchObject({
      query_summary: expect.any(String),
      raw_values: expect.any(Object),
    });
  });
});
