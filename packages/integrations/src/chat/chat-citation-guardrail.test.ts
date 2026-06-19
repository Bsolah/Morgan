import { describe, expect, it } from "vitest";
import {
  answerHasUnsupportedNumericClaims,
  enforceChatCitationGuardrail,
} from "./chat-citation-guardrail.js";

describe("chat citation guardrail", () => {
  it("blocks numeric claims without citations", () => {
    expect(
      answerHasUnsupportedNumericClaims("Profit was $4,280 yesterday.", []),
    ).toBe(true);
  });

  it("allows numeric claims backed by citation raw values", () => {
    expect(
      answerHasUnsupportedNumericClaims("Contribution profit was $3,600 yesterday.", [
        {
          source_table: "mart_orders_daily",
          source_date: "2026-06-16",
          raw_values: { contribution_margin: 3600 },
        } as never,
      ]),
    ).toBe(false);
  });

  it("replaces blocked responses with safe fallback text", () => {
    const blocked = enforceChatCitationGuardrail({
      answer: "You earned $99,999 yesterday.",
      citations: [],
      confidence: "high",
      follow_ups: [],
    });

    expect(blocked.answer).toContain("verified data source");
    expect(blocked.confidence).toBe("low");
    expect(blocked.follow_ups.length).toBeGreaterThanOrEqual(2);
  });
});
