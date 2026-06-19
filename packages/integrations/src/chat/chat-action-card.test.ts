import { describe, expect, it } from "vitest";
import { attachChatActionCard, mapRecommendationToActionCard } from "./chat-action-card.js";
import type { ChatDataContext } from "./chat-synthesis.js";

const recommendation = {
  id: "rec-1",
  title: "Pause Campaign X",
  body: "POAS below 1 for 7 days.",
  category: "ad_waste",
  impact_low_usd: 420,
  impact_high_usd: 420,
  status: "active",
};

const baseContext: ChatDataContext = {
  intent: { type: "ad_campaigns" },
  timezone: "UTC",
  referenceDay: "2026-06-16",
  profitSeries: [],
  runwayDays: null,
  adSpend7d: 1500,
};

describe("chat action card", () => {
  it("maps recommendation to action card payload", () => {
    expect(mapRecommendationToActionCard(recommendation)).toMatchObject({
      recommendation_id: "rec-1",
      title: "Pause Campaign X",
      status: "open",
      impact_label: "Impact ~$420",
    });
  });

  it("attaches action card for campaign intents with active recommendation", () => {
    const result = attachChatActionCard(
      {
        answer: "Review underperforming campaigns.",
        citations: [],
        confidence: "medium",
        follow_ups: [],
      },
      { ...baseContext, topRecommendation: recommendation },
    );

    expect(result.action_card?.recommendation_id).toBe("rec-1");
  });

  it("skips action card for general intents", () => {
    const result = attachChatActionCard(
      {
        answer: "General answer",
        citations: [],
        confidence: "medium",
        follow_ups: [],
      },
      {
        ...baseContext,
        intent: { type: "general" },
        topRecommendation: recommendation,
      },
    );

    expect(result.action_card).toBeUndefined();
  });
});
