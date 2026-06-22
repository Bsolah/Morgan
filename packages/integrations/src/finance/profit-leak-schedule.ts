import {
  merchantLocalDay,
  merchantLocalHourMinute,
  parseBriefingTimeLocal,
} from "../briefing/briefing.js";

export const DEFAULT_LEAK_SCAN_TIME_LOCAL = "05:30";

/** True once per merchant-local day after the configured scan time (default 05:30). */
export function shouldRunProfitLeakScan(input: {
  timezone: string;
  lastScanDay: string | null;
  scanTimeLocal?: string;
  at?: Date;
}): boolean {
  const at = input.at ?? new Date();
  const localDay = merchantLocalDay(input.timezone, at);
  if (input.lastScanDay === localDay) return false;

  const { hour: targetHour, minute: targetMinute } = parseBriefingTimeLocal(
    input.scanTimeLocal ?? DEFAULT_LEAK_SCAN_TIME_LOCAL,
  );
  const { hour, minute } = merchantLocalHourMinute(input.timezone, at);
  const currentMinutes = hour * 60 + minute;
  const targetMinutes = targetHour * 60 + targetMinute;

  return currentMinutes >= targetMinutes;
}
