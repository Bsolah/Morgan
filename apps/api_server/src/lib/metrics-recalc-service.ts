import { and, eq, isNotNull } from "drizzle-orm";
import { merchantFinanceConfig, type Database } from "@morgan/db";
import { recalculatePoasForStore } from "./poas-service.js";
import { runProfitLeakScanForStore } from "./profit-leak-scan-service.js";

export async function recalculateMetricsForStore(db: Database, storeId: string): Promise<void> {
  await recalculatePoasForStore(db, storeId);
  await runProfitLeakScanForStore(db, storeId, { force: true });
}

export async function markMetricsRecalcStarted(db: Database, storeId: string): Promise<void> {
  await db
    .update(merchantFinanceConfig)
    .set({
      metricsRecalcStartedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(merchantFinanceConfig.storeId, storeId));
}

export async function markMetricsRecalcCompleted(db: Database, storeId: string): Promise<void> {
  await db
    .update(merchantFinanceConfig)
    .set({
      metricsRecalcCompletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(merchantFinanceConfig.storeId, storeId));
}

export async function resetMetricsRecalcStarted(db: Database, storeId: string): Promise<void> {
  await db
    .update(merchantFinanceConfig)
    .set({
      metricsRecalcStartedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(merchantFinanceConfig.storeId, storeId));
}

function isPendingRecalculation(row: typeof merchantFinanceConfig.$inferSelect): boolean {
  if (!row.metricsRecalcRequestedAt) return false;
  if (!row.metricsRecalcCompletedAt) return true;
  return row.metricsRecalcCompletedAt.getTime() < row.metricsRecalcRequestedAt.getTime();
}

export async function listPendingMetricsRecalculations(db: Database): Promise<string[]> {
  const rows = await db
    .select()
    .from(merchantFinanceConfig)
    .where(isNotNull(merchantFinanceConfig.metricsRecalcRequestedAt));

  return rows.filter(isPendingRecalculation).map((row) => row.storeId);
}

export async function processMetricsRecalculationForStore(
  db: Database,
  storeId: string,
): Promise<boolean> {
  const [row] = await db
    .select()
    .from(merchantFinanceConfig)
    .where(eq(merchantFinanceConfig.storeId, storeId))
    .limit(1);

  if (!row || !isPendingRecalculation(row)) {
    return false;
  }

  if (!row.metricsRecalcStartedAt) {
    await markMetricsRecalcStarted(db, storeId);
  }

  try {
    await recalculateMetricsForStore(db, storeId);
    await markMetricsRecalcCompleted(db, storeId);
    return true;
  } catch {
    await resetMetricsRecalcStarted(db, storeId);
    throw new Error(`metrics_recalc_failed:${storeId}`);
  }
}

export async function processPendingMetricsRecalculations(db: Database): Promise<number> {
  const storeIds = await listPendingMetricsRecalculations(db);
  let processed = 0;

  for (const storeId of storeIds) {
    try {
      const ran = await processMetricsRecalculationForStore(db, storeId);
      if (ran) processed += 1;
    } catch {
      // Leave pending for the next poll tick.
    }
  }

  return processed;
}

export function scheduleMetricsRecalculation(db: Database, storeId: string): void {
  setImmediate(() => {
    void processMetricsRecalculationForStore(db, storeId).catch(() => {
      // Runner will retry if immediate processing fails.
    });
  });
}
