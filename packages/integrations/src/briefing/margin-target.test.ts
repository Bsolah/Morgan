import { describe, expect, it } from "vitest";
import {
  appendMarginTargetWeeklySummary,
  buildBriefingMarginTarget,
  computeContributionMarginPct,
  computeMarginProgressPct,
  composeMarginTargetWeeklySummary,
  isBelowMarginTarget,
  parseTargetMarginPct,
} from "./margin-target.js";

describe("margin target", () => {
  it("defaults invalid target margin to 40%", () => {
    expect(parseTargetMarginPct(null)).toBe(40);
    expect(parseTargetMarginPct(-5)).toBe(40);
    expect(parseTargetMarginPct(150)).toBe(40);
  });

  it("computes contribution margin pct from revenue", () => {
    expect(computeContributionMarginPct(4000, 10000)).toBe(40);
    expect(computeContributionMarginPct(0, 0)).toBeNull();
  });

  it("computes progress toward target", () => {
    expect(computeMarginProgressPct(30, 40)).toBe(75);
    expect(computeMarginProgressPct(50, 40)).toBe(100);
  });

  it("detects below-target margin", () => {
    expect(isBelowMarginTarget(35, 40)).toBe(true);
    expect(isBelowMarginTarget(40, 40)).toBe(false);
    expect(isBelowMarginTarget(null, 40)).toBe(false);
  });

  it("builds weekly summary when below target", () => {
    const marginTarget = buildBriefingMarginTarget({
      contributionMargin7d: 2800,
      netRevenue7d: 10000,
      priorContributionMargin7d: 3000,
      priorNetRevenue7d: 10000,
      targetMarginPct: 40,
    });

    expect(marginTarget).not.toBeNull();
    expect(marginTarget?.below_target).toBe(true);
    expect(marginTarget?.progress_pct).toBe(70);
    expect(marginTarget?.weekly_summary).toContain("Weekly margin check");
    expect(marginTarget?.weekly_summary).toContain("28.0%");
  });

  it("skips weekly summary when at or above target", () => {
    expect(
      buildBriefingMarginTarget({
        contributionMargin7d: 4500,
        netRevenue7d: 10000,
        targetMarginPct: 40,
      }),
    ).toBeNull();
  });

  it("appends weekly summary to narrative", () => {
    const summary = composeMarginTargetWeeklySummary({
      currentMarginPct: 28,
      targetMarginPct: 40,
    });
    const narrative = appendMarginTargetWeeklySummary("Your daily financial briefing.", {
      current_margin_pct: 28,
      target_margin_pct: 40,
      progress_pct: 70,
      below_target: true,
      weekly_summary: summary,
    });

    expect(narrative).toContain("Your daily financial briefing.");
    expect(narrative).toContain("Weekly margin check");
  });
});
