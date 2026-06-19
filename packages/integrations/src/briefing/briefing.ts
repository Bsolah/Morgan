export const BRIEFING_HEADLINE_MAX_CHARS = 140;
export const BRIEFING_NARRATIVE_MAX_WORDS = 400;
export const BRIEFING_METRIC_TOLERANCE_PCT = 0.1;

export type BriefingKpiDelta = {
  key: string;
  label: string;
  value: number;
  prior_value: number;
  delta_pct: number;
  direction: "up" | "down" | "flat";
  format: "currency" | "ratio" | "count" | "percent";
};

export type BriefingTopAction = {
  title: string;
  body: string;
  category: string;
  impact_low_usd: number | null;
  impact_high_usd: number | null;
  source: "profit_leak" | "recommendation" | "fallback";
  external_key: string | null;
};

export type BriefingSummaryJson = {
  kpi_deltas: BriefingKpiDelta[];
  top_action: BriefingTopAction;
  metrics_as_of: string | null;
  meta_connected: boolean;
  source: "llm" | "template";
  trigger?: "scheduled" | "critical_alert";
  alert_type?: string | null;
};

export type BriefingLlmOutput = {
  headline: string;
  narrative: string;
  highlights?: string[];
};

export function parseBriefingLlmOutput(raw: unknown): BriefingLlmOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.headline !== "string" || typeof value.narrative !== "string") return null;
  if (value.headline.length > BRIEFING_HEADLINE_MAX_CHARS) return null;

  const highlights = Array.isArray(value.highlights)
    ? value.highlights.filter((item): item is string => typeof item === "string").slice(0, 5)
    : undefined;

  return {
    headline: value.headline,
    narrative: value.narrative,
    highlights,
  };
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function clampHeadline(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= BRIEFING_HEADLINE_MAX_CHARS) return trimmed;
  return `${trimmed.slice(0, BRIEFING_HEADLINE_MAX_CHARS - 1)}…`;
}

export function clampNarrative(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= BRIEFING_NARRATIVE_MAX_WORDS) return words.join(" ");
  return `${words.slice(0, BRIEFING_NARRATIVE_MAX_WORDS).join(" ")}…`;
}

export function computeDeltaPct(current: number, prior: number): number {
  if (prior === 0) return current === 0 ? 0 : 100;
  return ((current - prior) / Math.abs(prior)) * 100;
}

export function deltaDirection(deltaPct: number): "up" | "down" | "flat" {
  if (Math.abs(deltaPct) < 0.05) return "flat";
  return deltaPct > 0 ? "up" : "down";
}

export function buildKpiDelta(input: {
  key: string;
  label: string;
  value: number;
  priorValue: number;
  format: BriefingKpiDelta["format"];
}): BriefingKpiDelta {
  const deltaPct = computeDeltaPct(input.value, input.priorValue);
  return {
    key: input.key,
    label: input.label,
    value: input.value,
    prior_value: input.priorValue,
    delta_pct: Math.round(deltaPct * 10) / 10,
    direction: deltaDirection(deltaPct),
    format: input.format,
  };
}

export function extractNumericTokens(text: string): number[] {
  const matches = text.match(/-?\d[\d,]*(?:\.\d+)?/g) ?? [];
  return matches
    .map((token) => Number(token.replace(/,/g, "")))
    .filter((value) => Number.isFinite(value))
    .filter((value) => Math.abs(value) >= 10 || !Number.isInteger(value));
}

export function metricValuesWithinTolerance(
  narrativeNumbers: number[],
  allowedNumbers: number[],
  tolerancePct = BRIEFING_METRIC_TOLERANCE_PCT,
): boolean {
  if (narrativeNumbers.length === 0) return true;

  for (const narrativeValue of narrativeNumbers) {
    const matched = allowedNumbers.some((allowed) => {
      if (allowed === 0) return narrativeValue === 0;
      const diffPct = (Math.abs(narrativeValue - allowed) / Math.abs(allowed)) * 100;
      return diffPct <= tolerancePct;
    });
    if (!matched) return false;
  }

  return true;
}

export function buildAllowedMetricNumbers(
  metrics: Record<string, number>,
  kpiDeltas: BriefingKpiDelta[],
): number[] {
  const values = new Set<number>();

  const add = (value: number) => {
    if (!Number.isFinite(value)) return;
    values.add(Math.round(value * 100) / 100);
    values.add(Math.round(value));
  };

  for (const value of Object.values(metrics)) {
    add(value);
  }

  for (const delta of kpiDeltas) {
    add(delta.value);
    add(delta.prior_value);
    add(Math.abs(delta.delta_pct));
    if (delta.format === "percent") {
      add(delta.value * 100);
      add(delta.prior_value * 100);
    }
    if (delta.format === "currency") {
      add(Math.round(delta.value));
      add(Math.round(delta.prior_value));
    }
  }

  return [...values];
}

export function composeTemplateBrief(input: {
  briefingDate: string;
  kpiDeltas: BriefingKpiDelta[];
  topAction: BriefingTopAction;
  metaConnected: boolean;
  metrics: Record<string, number>;
}): BriefingLlmOutput {
  const profit = input.kpiDeltas.find((row) => row.key === "contribution_margin_7d");
  const revenue = input.kpiDeltas.find((row) => row.key === "net_revenue_7d");
  const third = input.kpiDeltas.find(
    (row) => row.key !== "contribution_margin_7d" && row.key !== "net_revenue_7d",
  );

  const profitLine = profit
    ? `Contribution profit over the last week is $${Math.round(profit.value).toLocaleString("en-US")}, ${profit.delta_pct >= 0 ? "up" : "down"} ${Math.abs(profit.delta_pct).toFixed(1)}% versus the prior week.`
    : "Contribution profit trends are still stabilizing as Morgan ingests more orders.";

  const revenueLine = revenue
    ? `Net revenue landed at $${Math.round(revenue.value).toLocaleString("en-US")} (${revenue.delta_pct >= 0 ? "+" : ""}${revenue.delta_pct.toFixed(1)}% vs prior week).`
    : "";

  const thirdLine = third
    ? `${third.label} is ${third.format === "percent" ? `${(third.value * 100).toFixed(1)}%` : third.value.toFixed(2)} (${third.delta_pct >= 0 ? "+" : ""}${third.delta_pct.toFixed(1)}% vs prior week).`
    : input.metaConnected
      ? "Marketing efficiency metrics are included below for connected ad accounts."
      : "Connect Meta Ads to unlock marketing efficiency in tomorrow's brief.";

  const headline =
    profit && profit.delta_pct >= 5
      ? "Profit momentum improved this week"
      : profit && profit.delta_pct <= -5
        ? "Profit dipped — review today's action"
        : "Your daily financial briefing";

  return {
    headline: clampHeadline(headline),
    narrative: clampNarrative(
      [
        profitLine,
        revenueLine,
        thirdLine,
        `Today's top action: ${input.topAction.title}. ${input.topAction.body}`,
      ]
        .filter(Boolean)
        .join(" "),
    ),
  };
}

export function merchantLocalDay(timezone: string, at = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(at);
}

export function merchantLocalHourMinute(
  timezone: string,
  at = new Date(),
): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(at);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return { hour, minute };
}

export function parseBriefingTimeLocal(value: string): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return { hour: 6, minute: 0 };
  return {
    hour: Math.min(23, Math.max(0, Number(match[1]))),
    minute: Math.min(59, Math.max(0, Number(match[2]))),
  };
}

export function shouldGenerateDailyBriefing(input: {
  timezone: string;
  briefingTimeLocal: string;
  lastBriefingDate: string | null;
  at?: Date;
}): boolean {
  const at = input.at ?? new Date();
  const localDay = merchantLocalDay(input.timezone, at);
  if (input.lastBriefingDate === localDay) return false;

  const { hour: targetHour, minute: targetMinute } = parseBriefingTimeLocal(input.briefingTimeLocal);
  const { hour, minute } = merchantLocalHourMinute(input.timezone, at);
  const currentMinutes = hour * 60 + minute;
  const targetMinutes = targetHour * 60 + targetMinute;

  return currentMinutes >= targetMinutes;
}

export function addDays(isoDay: string, days: number): string {
  const date = new Date(`${isoDay}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function zonedLocalToUtcIso(
  timezone: string,
  localDay: string,
  hour: number,
  minute: number,
): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const targetMinutes = hour * 60 + minute;
  let utc = new Date(`${localDay}T${pad(hour)}:${pad(minute)}:00.000Z`);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const day = merchantLocalDay(timezone, utc);
    const parts = merchantLocalHourMinute(timezone, utc);
    const currentMinutes = parts.hour * 60 + parts.minute;
    const dayOffsetMinutes =
      (Date.parse(`${day}T00:00:00.000Z`) - Date.parse(`${localDay}T00:00:00.000Z`)) / 60_000;
    const diffMinutes = dayOffsetMinutes + (currentMinutes - targetMinutes);
    if (diffMinutes === 0) break;
    utc = new Date(utc.getTime() - diffMinutes * 60_000);
  }

  return utc.toISOString();
}

export function isBriefingQuietHours(
  timezone: string,
  at = new Date(),
  quietStartHour = 22,
  quietEndHour = 5,
): boolean {
  const { hour } = merchantLocalHourMinute(timezone, at);
  if (quietStartHour < quietEndHour) {
    return hour >= quietStartHour && hour < quietEndHour;
  }
  return hour >= quietStartHour || hour < quietEndHour;
}

export function shouldAllowCriticalBriefRegeneration(input: {
  timezone: string;
  runwayDays: number | null;
  at?: Date;
  quietStartHour?: number;
  quietEndHour?: number;
  criticalCashOverrideDays?: number;
}): boolean {
  const at = input.at ?? new Date();
  const overrideDays = input.criticalCashOverrideDays ?? 3;
  const inQuietHours = isBriefingQuietHours(
    input.timezone,
    at,
    input.quietStartHour ?? 22,
    input.quietEndHour ?? 5,
  );

  if (!inQuietHours) return true;
  return input.runwayDays != null && input.runwayDays < overrideDays;
}

export function computeNextBriefingAt(
  timezone: string,
  briefingTimeLocal: string,
  at = new Date(),
): string {
  const { hour, minute } = parseBriefingTimeLocal(briefingTimeLocal);
  let targetDay = merchantLocalDay(timezone, at);
  const { hour: currentHour, minute: currentMinute } = merchantLocalHourMinute(timezone, at);
  if (currentHour * 60 + currentMinute >= hour * 60 + minute) {
    targetDay = addDays(targetDay, 1);
  }

  return zonedLocalToUtcIso(timezone, targetDay, hour, minute);
}
