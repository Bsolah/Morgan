import { describe, expect, it } from "vitest";
import { chunkDateRange, META_INSIGHT_LEVELS } from "./insights.js";

describe("meta insights helpers", () => {
  it("chunks a date range into windows", () => {
    const chunks = chunkDateRange("2026-06-01", "2026-06-10", 3);
    expect(chunks).toEqual([
      { since: "2026-06-01", until: "2026-06-03" },
      { since: "2026-06-04", until: "2026-06-06" },
      { since: "2026-06-07", until: "2026-06-09" },
      { since: "2026-06-10", until: "2026-06-10" },
    ]);
  });

  it("includes all insight levels", () => {
    expect(META_INSIGHT_LEVELS).toEqual(["account", "campaign", "adset", "ad"]);
  });
});
