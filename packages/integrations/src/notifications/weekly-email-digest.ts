import {
  addDays,
  merchantLocalDay,
  merchantLocalHourMinute,
  parseBriefingTimeLocal,
} from "../briefing/briefing.js";

export const DEFAULT_WEEKLY_DIGEST_TIME_LOCAL = "07:00";

export function merchantWeekdayIso(timezone: string, at = new Date()): number {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(at);

  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  return map[short] ?? 7;
}

export function weekStartMondayFromLocalDay(localDay: string, timezone: string): string {
  let cursor = localDay;

  for (let i = 0; i < 7; i += 1) {
    const at = new Date(`${cursor}T12:00:00.000Z`);
    if (merchantWeekdayIso(timezone, at) === 1) return cursor;
    cursor = addDays(cursor, -1);
  }

  return localDay;
}

export function shouldSendWeeklyEmailDigest(input: {
  timezone: string;
  digestTimeLocal?: string;
  lastSentWeekStart: string | null;
  at?: Date;
}): boolean {
  const at = input.at ?? new Date();
  const timezone = input.timezone;
  const localDay = merchantLocalDay(timezone, at);

  if (merchantWeekdayIso(timezone, at) !== 1) return false;

  const weekStart = weekStartMondayFromLocalDay(localDay, timezone);
  if (input.lastSentWeekStart === weekStart) return false;

  const digestTimeLocal = input.digestTimeLocal ?? DEFAULT_WEEKLY_DIGEST_TIME_LOCAL;
  const { hour: targetHour, minute: targetMinute } = parseBriefingTimeLocal(digestTimeLocal);
  const { hour, minute } = merchantLocalHourMinute(timezone, at);
  const currentMinutes = hour * 60 + minute;
  const targetMinutes = targetHour * 60 + targetMinute;

  return currentMinutes >= targetMinutes;
}

export function formatWeekLabel(weekStart: string, timezone: string): string {
  const weekEnd = addDays(weekStart, 6);
  const formatDay = (day: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
    }).format(new Date(`${day}T12:00:00.000Z`));

  return `${formatDay(weekStart)} – ${formatDay(weekEnd)}`;
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatMarginTrend(input: {
  currentMarginPct: number | null;
  marginDeltaPct: number | null;
}): string {
  if (input.currentMarginPct == null) {
    return "Margin trend unavailable — sync more order data";
  }

  if (input.marginDeltaPct == null) {
    return `${input.currentMarginPct.toFixed(1)}% contribution margin (7d)`;
  }

  const sign = input.marginDeltaPct >= 0 ? "+" : "";
  return `${input.currentMarginPct.toFixed(1)}% (${sign}${input.marginDeltaPct.toFixed(1)} pts vs prior week)`;
}

export function formatRunwayLabel(input: {
  bankConnected: boolean;
  runwayDays: number | null;
  runwayStatus: string;
  message: string | null;
}): string {
  if (!input.bankConnected) {
    return "Connect your bank to track cash runway";
  }

  if (input.runwayDays != null) {
    const days = Math.round(input.runwayDays);
    return `${days} day${days === 1 ? "" : "s"} remaining (${input.runwayStatus.replace(/_/g, " ")})`;
  }

  return input.message ?? "Runway will appear after bank data syncs";
}
