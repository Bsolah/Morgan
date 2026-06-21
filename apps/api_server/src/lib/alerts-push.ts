import type { AlertRecord, NotificationPrefs } from "./alerts-data.js";
import { getNotificationPrefs, logPushSent, wasPushSent } from "./alerts-store.js";

export function isQuietHours(now: Date, prefs: NotificationPrefs): boolean {
  if (!prefs.quiet_hours_enabled) return false;

  const hour = now.getHours();
  const { quiet_hours_start: start, quiet_hours_end: end } = prefs;

  if (start > end) {
    return hour >= start || hour < end;
  }

  return hour >= start && hour < end;
}

/** Critical cash crunch alerts override quiet hours. */
export function shouldBypassQuietHours(alert: AlertRecord): boolean {
  return alert.type === "cash_crunch" && alert.severity === "critical";
}

export function maybeSendAlertPush(
  storeId: string,
  alert: AlertRecord,
  now: Date = new Date(),
): boolean {
  if (alert.severity === "info") return false;
  if (wasPushSent(alert.id)) return false;

  const prefs = getNotificationPrefs(storeId);
  const enabled =
    alert.severity === "critical" ? prefs.push_critical : prefs.push_warnings;
  if (!enabled) return false;

  if (isQuietHours(now, prefs) && !shouldBypassQuietHours(alert)) {
    return false;
  }

  logPushSent(storeId, alert.id, now.toISOString());
  return true;
}
