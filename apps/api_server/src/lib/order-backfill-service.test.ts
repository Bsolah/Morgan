import { describe, expect, it } from "vitest";
import { formatOrderBackfillLabel } from "./order-backfill-service.js";

describe("formatOrderBackfillLabel", () => {
  it("formats in-progress order backfill copy", () => {
    expect(formatOrderBackfillLabel(12400, 18000, "processing")).toBe(
      "Importing order history… 12,400 / 18,000",
    );
  });

  it("formats completed copy", () => {
    expect(formatOrderBackfillLabel(18000, 18000, "completed")).toBe("Order history imported");
  });
});
