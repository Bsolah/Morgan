import { describe, expect, it } from "vitest";
import {
  detectChatIntent,
  synthesizeChatResponse,
  type ChatDataContext,
  type DailyProfitPoint,
} from "./chat-synthesis.js";

const baseContext = (overrides: Partial<ChatDataContext> = {}): ChatDataContext => ({
  intent: { type: "profit_change", focus: "yesterday" },
  timezone: "America/New_York",
  referenceDay: "2026-06-16",
  profitSeries: [
    { day: "2026-06-15", contribution_margin: 4200, net_revenue: 12000 },
    { day: "2026-06-16", contribution_margin: 3600, net_revenue: 11000 },
  ],
  runwayDays: null,
  adSpend7d: 1800,
  ...overrides,
});

describe("detectChatIntent", () => {
  it("detects profit drop questions", () => {
    expect(detectChatIntent("Why did profit drop yesterday?")).toEqual({
      type: "profit_change",
      focus: "yesterday",
    });
  });

  it("detects cash runway questions", () => {
    expect(detectChatIntent("What is my cash runway?")).toEqual({ type: "cash_runway" });
  });
});

describe("synthesizeChatResponse", () => {
  it("returns answer, citations, confidence, and follow ups for profit drop", () => {
    const result = synthesizeChatResponse(baseContext());

    expect(result.answer).toContain("3,600");
    expect(result.answer).toContain("4,200");
    expect(result.citations.length).toBeGreaterThanOrEqual(1);
    expect(result.citations[0]?.source_table).toBe("mart_orders_daily");
    expect(result.confidence).toBe("high");
    expect(result.follow_ups.length).toBeGreaterThanOrEqual(2);
  });

  it("handles missing profit series with low confidence", () => {
    const result = synthesizeChatResponse(
      baseContext({
        profitSeries: [] as DailyProfitPoint[],
      }),
    );

    expect(result.confidence).toBe("low");
    expect(result.follow_ups.length).toBeGreaterThanOrEqual(2);
  });
});
