import { describe, expect, it } from "vitest";
import { FinanceConfigError } from "./finance-config-service.js";

function validateManualPct(value: number | null | undefined) {
  if (value == null || Number.isNaN(value) || value < 0 || value > 100) {
    throw new FinanceConfigError("manual_cogs_pct must be between 0 and 100", "invalid_manual_pct");
  }
}

describe("finance config validation", () => {
  it("accepts manual pct between 0 and 100", () => {
    expect(() => validateManualPct(0)).not.toThrow();
    expect(() => validateManualPct(35.5)).not.toThrow();
    expect(() => validateManualPct(100)).not.toThrow();
  });

  it("rejects invalid manual pct", () => {
    expect(() => validateManualPct(null)).toThrow(FinanceConfigError);
    expect(() => validateManualPct(120)).toThrow(FinanceConfigError);
  });
});
