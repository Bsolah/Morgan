import type { Database } from "@morgan/db";
import type { AlertRecord, NotificationPrefs } from "./alerts-data.js";
import { getNotificationPrefs, logPushSent, wasPushSent } from "./alerts-store.js";
import { sendAlertPush } from "./alerts-push-delivery.js";

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

export function shouldSendAlertPush(alert: AlertRecord, now: Date = new Date()): boolean {
  if (alert.severity === "info") return false;
  if (wasPushSent(alert.id)) return false;

  const prefs = getNotificationPrefs(alert.store_id);
  const enabled =
    alert.severity === "critical" ? prefs.push_critical : prefs.push_warnings;
  if (!enabled) return false;

  if (isQuietHours(now, prefs) && !shouldBypassQuietHours(alert)) {
    return false;
  }

  return true;
}

export async function maybeSendAlertPush(
  db: Database | null,
  storeId: string,
  alert: AlertRecord,
  now: Date = new Date(),
): Promise<boolean> {
  if (!shouldSendAlertPush(alert, now)) return false;

  logPushSent(storeId, alert.id, now.toISOString());

  if (db) {
    await sendAlertPush(db, storeId, {
      alertId: alert.id,
      title: alert.title,
      body: alert.body,
      severity: alert.severity,
      type: alert.type,
    });
  }

  return true;
}
