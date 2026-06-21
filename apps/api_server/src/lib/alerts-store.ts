import { randomUUID } from "node:crypto";
import type { AlertRecord, NotificationPrefs } from "./alerts-data.js";
import { DEFAULT_NOTIFICATION_PREFS } from "./alerts-data.js";

const alertsByStore = new Map<string, AlertRecord[]>();
const notificationPrefsByStore = new Map<string, NotificationPrefs>();
const pushLog: Array<{ alert_id: string; store_id: string; sent_at: string }> = [];

export function resetAlertsStore(): void {
  alertsByStore.clear();
  notificationPrefsByStore.clear();
  pushLog.length = 0;
}

function storeAlerts(storeId: string): AlertRecord[] {
  let alerts = alertsByStore.get(storeId);
  if (!alerts) {
    alerts = [];
    alertsByStore.set(storeId, alerts);
  }
  return alerts;
}

export function getNotificationPrefs(storeId: string): NotificationPrefs {
  return notificationPrefsByStore.get(storeId) ?? DEFAULT_NOTIFICATION_PREFS;
}

export function setNotificationPrefs(storeId: string, prefs: Partial<NotificationPrefs>): NotificationPrefs {
  const merged = { ...getNotificationPrefs(storeId), ...prefs };
  notificationPrefsByStore.set(storeId, merged);
  return merged;
}

export function listStoreAlerts(storeId: string): AlertRecord[] {
  return [...storeAlerts(storeId)].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function getStoreAlert(storeId: string, alertId: string): AlertRecord | undefined {
  return storeAlerts(storeId).find((alert) => alert.id === alertId);
}

export function countUnreadAlerts(storeId: string): number {
  return storeAlerts(storeId).filter((alert) => alert.read_at == null).length;
}

export function upsertStoreAlert(storeId: string, alert: AlertRecord): AlertRecord {
  const alerts = storeAlerts(storeId);
  const index = alerts.findIndex((item) => item.id === alert.id);
  if (index >= 0) {
    alerts[index] = alert;
  } else {
    alerts.push(alert);
  }
  return alert;
}

export function markAlertRead(storeId: string, alertId: string, readAt: string): AlertRecord | null {
  const alert = getStoreAlert(storeId, alertId);
  if (!alert) return null;
  alert.read_at = readAt;
  return alert;
}

export function newAlertId(): string {
  return randomUUID();
}

export function logPushSent(storeId: string, alertId: string, sentAt: string): void {
  pushLog.push({ alert_id: alertId, store_id: storeId, sent_at: sentAt });
}

export function getPushLog(): Array<{ alert_id: string; store_id: string; sent_at: string }> {
  return [...pushLog];
}

export function wasPushSent(alertId: string): boolean {
  return pushLog.some((entry) => entry.alert_id === alertId);
}
