export const DEFAULT_TARGET_MARGIN_PCT = 40;

export type BriefingMarginTarget = {
  current_margin_pct: number;
  target_margin_pct: number;
  progress_pct: number;
  below_target: boolean;
  weekly_summary: string;
};

export function parseTargetMarginPct(value: unknown): number {
  const pct = Number(value ?? DEFAULT_TARGET_MARGIN_PCT);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return DEFAULT_TARGET_MARGIN_PCT;
  return Math.round(pct * 10) / 10;
}

export function computeContributionMarginPct(
  contributionMargin: number,
  netRevenue: number,
): number | null {
  if (netRevenue <= 0) return null;
  return Math.round((contributionMargin / netRevenue) * 1000) / 10;
}

export function computeMarginProgressPct(
  currentMarginPct: number,
  targetMarginPct: number,
): number {
  if (targetMarginPct <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((currentMarginPct / targetMarginPct) * 100)));
}

export function isBelowMarginTarget(
  currentMarginPct: number | null,
  targetMarginPct: number,
): boolean {
  return currentMarginPct != null && currentMarginPct < targetMarginPct;
}

export function composeMarginTargetWeeklySummary(input: {
  currentMarginPct: number;
  targetMarginPct: number;
  priorMarginPct?: number | null;
}): string {
  const gap = input.targetMarginPct - input.currentMarginPct;
  const progress = computeMarginProgressPct(input.currentMarginPct, input.targetMarginPct);
  let trend = "";
  if (input.priorMarginPct != null) {
    const delta = input.currentMarginPct - input.priorMarginPct;
    trend =
      delta >= 0
        ? `, up ${delta.toFixed(1)} pts vs prior week`
        : `, down ${Math.abs(delta).toFixed(1)} pts vs prior week`;
  }

  return `Weekly margin check: ${input.currentMarginPct.toFixed(1)}% contribution margin (${progress}% of your ${input.targetMarginPct.toFixed(0)}% target, ${gap.toFixed(1)} pts short${trend}). Review pricing, returns, and ad spend to close the gap.`;
}

export function buildBriefingMarginTarget(input: {
  contributionMargin7d: number;
  netRevenue7d: number;
  priorContributionMargin7d?: number;
  priorNetRevenue7d?: number;
  targetMarginPct: number;
}): BriefingMarginTarget | null {
  const currentMarginPct = computeContributionMarginPct(
    input.contributionMargin7d,
    input.netRevenue7d,
  );
  if (!isBelowMarginTarget(currentMarginPct, input.targetMarginPct) || currentMarginPct == null) {
    return null;
  }

  const priorMarginPct =
    input.priorContributionMargin7d != null && input.priorNetRevenue7d != null
      ? computeContributionMarginPct(input.priorContributionMargin7d, input.priorNetRevenue7d)
      : null;

  const weeklySummary = composeMarginTargetWeeklySummary({
    currentMarginPct,
    targetMarginPct: input.targetMarginPct,
    priorMarginPct,
  });

  return {
    current_margin_pct: currentMarginPct,
    target_margin_pct: input.targetMarginPct,
    progress_pct: computeMarginProgressPct(currentMarginPct, input.targetMarginPct),
    below_target: true,
    weekly_summary: weeklySummary,
  };
}

export function appendMarginTargetWeeklySummary(
  narrative: string,
  marginTarget: BriefingMarginTarget,
): string {
  return `${narrative.trim()} ${marginTarget.weekly_summary}`.trim();
}
