import { and, desc, eq, isNull } from "drizzle-orm";
import { alerts, type Database } from "@morgan/db";
import type { AlertRecord, AlertSeverity, AlertType } from "./alerts-data.js";

type PersistedAlertSnapshot = Record<string, unknown> & {
  magnitude?: string;
  top_driver?: string;
  links?: AlertRecord["links"];
};

function rowToAlertRecord(row: typeof alerts.$inferSelect): AlertRecord {
  const snapshot = (row.metricSnapshot ?? {}) as PersistedAlertSnapshot;
  const { magnitude, top_driver, links, ...metricFields } = snapshot;

  return {
    id: row.id,
    store_id: row.storeId,
    severity: row.severity as AlertSeverity,
    type: row.type as AlertType,
    title: row.title,
    body: row.body,
    magnitude: typeof magnitude === "string" ? magnitude : "",
    top_driver: typeof top_driver === "string" ? top_driver : "",
    links: (links ?? {}) as AlertRecord["links"],
    metric_snapshot: metricFields,
    read_at: row.readAt ? row.readAt.toISOString() : null,
    created_at: row.createdAt.toISOString(),
  };
}

function alertToSnapshot(alert: AlertRecord): PersistedAlertSnapshot {
  return {
    ...alert.metric_snapshot,
    magnitude: alert.magnitude,
    top_driver: alert.top_driver,
    links: alert.links,
  };
}

export async function listPersistedAlerts(db: Database, storeId: string): Promise<AlertRecord[]> {
  const rows = await db
    .select()
    .from(alerts)
    .where(eq(alerts.storeId, storeId))
    .orderBy(desc(alerts.createdAt));

  return rows.map(rowToAlertRecord);
}

export async function getPersistedAlert(
  db: Database,
  storeId: string,
  alertId: string,
): Promise<AlertRecord | null> {
  const [row] = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.storeId, storeId), eq(alerts.id, alertId)))
    .limit(1);

  return row ? rowToAlertRecord(row) : null;
}

export async function findPersistedAlertByDedupeKey(
  db: Database,
  storeId: string,
  dedupeKey: string,
): Promise<AlertRecord | null> {
  const [row] = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.storeId, storeId), eq(alerts.dedupeKey, dedupeKey)))
    .limit(1);

  return row ? rowToAlertRecord(row) : null;
}

export async function upsertPersistedAlert(
  db: Database,
  alert: AlertRecord,
  dedupeKey: string,
): Promise<AlertRecord> {
  const existing = await findPersistedAlertByDedupeKey(db, alert.store_id, dedupeKey);
  const readAt = alert.read_at ? new Date(alert.read_at) : existing?.read_at ? new Date(existing.read_at) : null;
  const createdAt = existing?.created_at ? new Date(existing.created_at) : new Date(alert.created_at);

  const [row] = await db
    .insert(alerts)
    .values({
      id: existing?.id ?? alert.id,
      storeId: alert.store_id,
      severity: alert.severity,
      type: alert.type,
      title: alert.title,
      body: alert.body,
      metricSnapshot: alertToSnapshot(alert),
      dedupeKey,
      readAt,
      createdAt,
    })
    .onConflictDoUpdate({
      target: [alerts.storeId, alerts.dedupeKey],
      set: {
        severity: alert.severity,
        type: alert.type,
        title: alert.title,
        body: alert.body,
        metricSnapshot: alertToSnapshot(alert),
      },
    })
    .returning();

  if (!row) {
    throw new Error("Failed to upsert alert");
  }

  return rowToAlertRecord(row);
}

export async function markPersistedAlertRead(
  db: Database,
  storeId: string,
  alertId: string,
  readAt: string,
): Promise<AlertRecord | null> {
  const [row] = await db
    .update(alerts)
    .set({ readAt: new Date(readAt) })
    .where(and(eq(alerts.storeId, storeId), eq(alerts.id, alertId)))
    .returning();

  return row ? rowToAlertRecord(row) : null;
}

export async function countUnreadPersistedAlerts(db: Database, storeId: string): Promise<number> {
  const rows = await db
    .select({ id: alerts.id })
    .from(alerts)
    .where(and(eq(alerts.storeId, storeId), isNull(alerts.readAt)));

  return rows.length;
}

export async function deletePersistedAlertByDedupeKey(
  db: Database,
  storeId: string,
  dedupeKey: string,
): Promise<void> {
  await db
    .delete(alerts)
    .where(and(eq(alerts.storeId, storeId), eq(alerts.dedupeKey, dedupeKey)));
}
