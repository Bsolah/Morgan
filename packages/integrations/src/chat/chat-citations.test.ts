import { describe, expect, it } from "vitest";
import {
  enrichChatCitation,
  formatCitationChipDate,
  formatCitationSourceLabel,
  isCitationStale,
} from "./chat-citations.js";
import type { ChatDataContext } from "./chat-synthesis.js";

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

describe("chat citations", () => {
  it("formats chip labels", () => {
    expect(formatCitationSourceLabel("mart_orders_daily")).toBe("orders_daily");
    expect(formatCitationChipDate("2026-06-14")).toBe("Jun 14");
  });

  it("enriches citations with query summary and raw values", () => {
    const enriched = enrichChatCitation(
      {
        source_table: "mart_orders_daily",
        source_date: "2026-06-16",
        metric: "contribution_margin",
      },
      context,
      new Date("2026-06-17T12:00:00Z"),
    );

    expect(enriched.query_summary).toContain("Shopify");
    expect(enriched.raw_values).toMatchObject({
      contribution_margin: 3600,
      net_revenue: 11000,
    });
    expect(enriched.is_stale).toBe(false);
  });

  it("flags stale citations older than 48 hours", () => {
    expect(isCitationStale("2026-06-10T23:59:59.000Z", new Date("2026-06-17T12:00:00Z"))).toBe(true);
    expect(isCitationStale("2026-06-16T23:59:59.000Z", new Date("2026-06-17T12:00:00Z"))).toBe(false);
  });
});
