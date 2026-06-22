import type { Database } from "@morgan/db";
import { env } from "../config.js";
import type { AlertRecord } from "./alerts-data.js";
import {
  countUnreadPersistedAlerts,
  deletePersistedAlertByDedupeKey,
  findPersistedAlertByDedupeKey,
  getPersistedAlert,
  listPersistedAlerts,
  markPersistedAlertRead,
  upsertPersistedAlert,
} from "./alerts-persistence.js";
import {
  countUnreadAlerts,
  getStoreAlert,
  listStoreAlerts,
  markAlertRead,
  upsertStoreAlert,
} from "./alerts-store.js";

function usePersistence(db: Database | null | undefined): db is Database {
  return Boolean(db) && env.NODE_ENV !== "test";
}

export async function listAlerts(db: Database | null, storeId: string): Promise<AlertRecord[]> {
  if (usePersistence(db)) {
    return listPersistedAlerts(db, storeId);
  }
  return listStoreAlerts(storeId);
}

export async function getAlert(
  db: Database | null,
  storeId: string,
  alertId: string,
): Promise<AlertRecord | undefined | null> {
  if (usePersistence(db)) {
    return (await getPersistedAlert(db, storeId, alertId)) ?? undefined;
  }
  return getStoreAlert(storeId, alertId);
}

export async function findAlertByDedupeKey(
  db: Database | null,
  storeId: string,
  dedupeKey: string,
): Promise<AlertRecord | null> {
  if (usePersistence(db)) {
    return findPersistedAlertByDedupeKey(db, storeId, dedupeKey);
  }
  return (
    listStoreAlerts(storeId).find(
      (alert) => (alert.metric_snapshot.dedupe_key as string | undefined) === dedupeKey,
    ) ?? null
  );
}

export async function saveAlert(
  db: Database | null,
  alert: AlertRecord,
  dedupeKey: string,
): Promise<AlertRecord> {
  const withDedupe = {
    ...alert,
    metric_snapshot: { ...alert.metric_snapshot, dedupe_key: dedupeKey },
  };

  if (usePersistence(db)) {
    return upsertPersistedAlert(db, withDedupe, dedupeKey);
  }

  const existing = listStoreAlerts(alert.store_id).find(
    (item) => (item.metric_snapshot.dedupe_key as string | undefined) === dedupeKey,
  );
  if (existing) {
    withDedupe.id = existing.id;
    withDedupe.read_at = existing.read_at;
    withDedupe.created_at = existing.created_at;
  }

  return upsertStoreAlert(alert.store_id, withDedupe);
}

export async function markAlertAsRead(
  db: Database | null,
  storeId: string,
  alertId: string,
  readAt: string,
): Promise<AlertRecord | null> {
  if (usePersistence(db)) {
    return markPersistedAlertRead(db, storeId, alertId, readAt);
  }
  return markAlertRead(storeId, alertId, readAt);
}

export async function countUnread(db: Database | null, storeId: string): Promise<number> {
  if (usePersistence(db)) {
    return countUnreadPersistedAlerts(db, storeId);
  }
  return countUnreadAlerts(storeId);
}

export async function clearAlertByDedupeKey(
  db: Database | null,
  storeId: string,
  dedupeKey: string,
): Promise<void> {
  if (usePersistence(db)) {
    await deletePersistedAlertByDedupeKey(db, storeId, dedupeKey);
    return;
  }

  const alerts = listStoreAlerts(storeId);
  const index = alerts.findIndex(
    (alert) => (alert.metric_snapshot.dedupe_key as string | undefined) === dedupeKey,
  );
  if (index >= 0) {
    alerts.splice(index, 1);
  }
}
