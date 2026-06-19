import type { Database } from "@morgan/db";
import { alerts } from "@morgan/db";
import { and, desc, eq, gte } from "drizzle-orm";
export type AlertSeverity = "info" | "warning" | "critical";

export type CreateStoreAlertInput = {
  storeId: string;
  severity: AlertSeverity;
  type: string;
  title: string;
  body: string;
  metricSnapshot?: Record<string, unknown>;
  dedupeKey: string;
};

export async function createStoreAlert(
  db: Database,
  input: CreateStoreAlertInput,
): Promise<boolean> {
  const inserted = await db
    .insert(alerts)
    .values({
      storeId: input.storeId,
      severity: input.severity,
      type: input.type,
      title: input.title,
      body: input.body,
      metricSnapshot: input.metricSnapshot,
      dedupeKey: input.dedupeKey,
    })
    .onConflictDoNothing()
    .returning({ id: alerts.id, severity: alerts.severity });

  if (inserted.length === 0) return false;

  if (input.severity === "critical") {
    const { maybeRegenerateBriefOnCriticalAlert } = await import(
      "./briefing-regeneration-service.js"
    );
    await maybeRegenerateBriefOnCriticalAlert(db, {
      storeId: input.storeId,
      alertType: input.type,
      metricSnapshot: input.metricSnapshot,
    });
  }

  return true;
}

export type StoreAlertView = {
  id: string;
  type: string;
  title: string;
  body: string;
  severity: AlertSeverity;
  created_at: string;
};

export async function listActiveStoreAlerts(
  db: Database,
  storeId: string,
  options?: { limit?: number; days?: number },
): Promise<StoreAlertView[]> {
  const limit = options?.limit ?? 10;
  const days = options?.days ?? 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      id: alerts.id,
      type: alerts.type,
      title: alerts.title,
      body: alerts.body,
      severity: alerts.severity,
      createdAt: alerts.createdAt,
    })
    .from(alerts)
    .where(and(eq(alerts.storeId, storeId), gte(alerts.createdAt, since)))
    .orderBy(desc(alerts.createdAt))
    .limit(limit);

  const severityRank: Record<AlertSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return rows
    .sort((left, right) => {
      const rankDiff =
        severityRank[left.severity as AlertSeverity] - severityRank[right.severity as AlertSeverity];
      if (rankDiff !== 0) return rankDiff;
      return right.createdAt.getTime() - left.createdAt.getTime();
    })
    .map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      severity: row.severity as AlertSeverity,
      created_at: row.createdAt.toISOString(),
    }));
}
