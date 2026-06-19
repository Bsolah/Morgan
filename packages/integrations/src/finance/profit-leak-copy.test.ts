import { describe, expect, it } from "vitest";
import { formatLeakEvidenceRows, leakBody, leakTitle, leakTypeLabel } from "./profit-leak-copy.js";

describe("profit-leak-copy", () => {
  it("labels MVP leak types", () => {
    expect(leakTypeLabel("ad_waste")).toBe("Ad waste");
    expect(leakTypeLabel("discount_bleed")).toBe("Discount bleed");
    expect(leakTypeLabel("return_drain")).toBe("Return drain");
    expect(leakTypeLabel("dead_stock")).toBe("Dead stock");
  });

  it("builds ad waste title and evidence rows", () => {
    const evidence = [{ campaign: "Summer Sale", poas: 0.72, spend_7d: 1800, channel: "meta" }];
    expect(leakTitle("ad_waste", evidence)).toBe("Pause Summer Sale");
    expect(leakBody("ad_waste", evidence)).toContain("POAS 0.72");
    expect(formatLeakEvidenceRows("ad_waste", evidence)).toEqual(
      expect.arrayContaining([
        { label: "Campaign", value: "Summer Sale" },
        { label: "POAS (7d)", value: "0.72" },
      ]),
    );
  });

  it("builds return drain copy from SKU evidence", () => {
    const evidence = [{ sku: "TEE-BLUE", return_rate_pct: 18.5, store_return_rate_pct: 6.2 }];
    expect(leakTitle("return_drain", evidence)).toBe("Reduce returns on TEE-BLUE");
    expect(leakBody("return_drain", evidence)).toContain("18.5%");
  });
});
