import { addDays, computeNextBriefingAt, merchantLocalDay, merchantLocalHourMinute, parseBriefingTimeLocal, zonedLocalToUtcIso } from "./briefing.js";

export type BriefingSchedulePending = {
  timezone: string | null;
  briefing_time_local: string | null;
  effective_from: string;
};

export type ResolvedBriefingSchedule = {
  timezone: string;
  briefing_time_local: string;
  pending: BriefingSchedulePending | null;
  next_briefing_at: string;
};

export function nextScheduleEffectiveFromDay(timezone: string, at = new Date()): string {
  return addDays(merchantLocalDay(timezone, at), 1);
}

export function resolveSchedulerBriefingSchedule(input: {
  timezone: string;
  briefingTimeLocal: string;
  pendingTimezone: string | null;
  pendingBriefingTimeLocal: string | null;
  scheduleEffectiveFrom: string | null;
  at?: Date;
}): { timezone: string; briefingTimeLocal: string } {
  const at = input.at ?? new Date();
  const localDay = merchantLocalDay(input.timezone, at);

  if (
    input.scheduleEffectiveFrom &&
    localDay >= input.scheduleEffectiveFrom &&
    (input.pendingTimezone || input.pendingBriefingTimeLocal)
  ) {
    return {
      timezone: input.pendingTimezone ?? input.timezone,
      briefingTimeLocal: input.pendingBriefingTimeLocal ?? input.briefingTimeLocal,
    };
  }

  return {
    timezone: input.timezone,
    briefingTimeLocal: input.briefingTimeLocal,
  };
}

export function hasPendingBriefingSchedule(input: {
  pendingTimezone: string | null;
  pendingBriefingTimeLocal: string | null;
  scheduleEffectiveFrom: string | null;
}): boolean {
  return Boolean(
    input.scheduleEffectiveFrom &&
      (input.pendingTimezone || input.pendingBriefingTimeLocal),
  );
}

export function computeNextBriefingDelivery(input: {
  timezone: string;
  briefingTimeLocal: string;
  pendingTimezone?: string | null;
  pendingBriefingTimeLocal?: string | null;
  scheduleEffectiveFrom?: string | null;
  at?: Date;
}): string {
  const at = input.at ?? new Date();
  const localDay = merchantLocalDay(input.timezone, at);
  const pending = hasPendingBriefingSchedule({
    pendingTimezone: input.pendingTimezone ?? null,
    pendingBriefingTimeLocal: input.pendingBriefingTimeLocal ?? null,
    scheduleEffectiveFrom: input.scheduleEffectiveFrom ?? null,
  });

  if (!pending || !input.scheduleEffectiveFrom) {
    return computeNextBriefingAt(input.timezone, input.briefingTimeLocal, at);
  }

  const { hour, minute } = parseBriefingTimeLocal(input.briefingTimeLocal);
  const { hour: currentHour, minute: currentMinute } = merchantLocalHourMinute(input.timezone, at);
  const currentMinutes = currentHour * 60 + currentMinute;
  const targetMinutes = hour * 60 + minute;

  if (input.scheduleEffectiveFrom > localDay && currentMinutes < targetMinutes) {
    return zonedLocalToUtcIso(input.timezone, localDay, hour, minute);
  }

  const pendingTimezone = input.pendingTimezone ?? input.timezone;
  const pendingTime = input.pendingBriefingTimeLocal ?? input.briefingTimeLocal;
  const pendingStartAt = new Date(
    zonedLocalToUtcIso(pendingTimezone, input.scheduleEffectiveFrom, 0, 0),
  );

  return computeNextBriefingAt(pendingTimezone, pendingTime, pendingStartAt);
}

export function buildBriefingScheduleView(input: {
  timezone: string;
  briefingTimeLocal: string;
  shopifyTimezone: string;
  timezoneOverridden: boolean;
  pendingTimezone: string | null;
  pendingBriefingTimeLocal: string | null;
  scheduleEffectiveFrom: string | null;
  at?: Date;
}): ResolvedBriefingSchedule {
  const pending = hasPendingBriefingSchedule({
    pendingTimezone: input.pendingTimezone,
    pendingBriefingTimeLocal: input.pendingBriefingTimeLocal,
    scheduleEffectiveFrom: input.scheduleEffectiveFrom,
  })
    ? {
        timezone: input.pendingTimezone,
        briefing_time_local: input.pendingBriefingTimeLocal,
        effective_from: input.scheduleEffectiveFrom!,
      }
    : null;

  return {
    timezone: input.timezone,
    briefing_time_local: input.briefingTimeLocal,
    pending,
    next_briefing_at: computeNextBriefingDelivery({
      timezone: input.timezone,
      briefingTimeLocal: input.briefingTimeLocal,
      pendingTimezone: input.pendingTimezone,
      pendingBriefingTimeLocal: input.pendingBriefingTimeLocal,
      scheduleEffectiveFrom: input.scheduleEffectiveFrom,
      at: input.at,
    }),
  };
}
