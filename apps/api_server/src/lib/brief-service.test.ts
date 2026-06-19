import { describe, expect, it } from "vitest";
import { addDays, merchantLocalDay } from "@morgan/integrations";

describe("listBriefingHistory shape", () => {
  it("builds 30-day window ending on merchant-local today", () => {
    const timezone = "America/New_York";
    const today = merchantLocalDay(timezone, new Date("2026-06-17T18:00:00.000Z"));
    const items = Array.from({ length: 30 }, (_, index) => addDays(today, -index));

    expect(items).toHaveLength(30);
    expect(items[0]).toBe(today);
    expect(items[29]).toBe(addDays(today, -29));
  });
});
