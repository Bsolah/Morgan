import { desc, eq } from "drizzle-orm";
import { syncRuns, stores, type Database } from "@morgan/db";

export type SyncTaskId = "orders" | "products" | "inventory";

export type SyncTaskStatus = {
  id: SyncTaskId;
  label: string;
  percent: number;
  status: "pending" | "syncing" | "complete";
};

export type SyncStatusResponse = {
  store_id: string;
  overall_percent: number;
  eta_minutes: number | null;
  tasks: SyncTaskStatus[];
  store_status: string;
};

const TASK_DEFS: Array<{ id: SyncTaskId; label: string; weight: number; startOffset: number }> = [
  { id: "orders", label: "Orders", weight: 0.45, startOffset: 0 },
  { id: "products", label: "Products", weight: 0.35, startOffset: 0.15 },
  { id: "inventory", label: "Inventory", weight: 0.2, startOffset: 0.35 },
];

/** Simulated sync progress until ingest worker writes real counters. */
const FULL_SYNC_MS = 4 * 60 * 1000;

function taskPercent(elapsedRatio: number, startOffset: number): number {
  const adjusted = (elapsedRatio - startOffset) / (1 - startOffset);
  if (adjusted <= 0) return 0;
  if (adjusted >= 1) return 100;
  return Math.round(adjusted * 100);
}

function taskStatus(percent: number): SyncTaskStatus["status"] {
  if (percent >= 100) return "complete";
  if (percent > 0) return "syncing";
  return "pending";
}

export function computeSyncStatus(input: {
  storeId: string;
  storeStatus: string;
  startedAt: Date;
  now?: Date;
}): SyncStatusResponse {
  const now = input.now ?? new Date();
  const elapsedMs = Math.max(0, now.getTime() - input.startedAt.getTime());
  const elapsedRatio = Math.min(1, elapsedMs / FULL_SYNC_MS);

  const tasks: SyncTaskStatus[] = TASK_DEFS.map((task) => {
    const percent = taskPercent(elapsedRatio, task.startOffset);
    return {
      id: task.id,
      label: task.label,
      percent,
      status: taskStatus(percent),
    };
  });

  const overall_percent = Math.round(
    tasks.reduce((sum, task, i) => sum + task.percent * TASK_DEFS[i]!.weight, 0),
  );

  const remainingMs = Math.max(0, FULL_SYNC_MS - elapsedMs);
  const eta_minutes = overall_percent >= 100 ? 0 : Math.max(1, Math.ceil(remainingMs / 60_000));

  return {
    store_id: input.storeId,
    overall_percent,
    eta_minutes: overall_percent >= 100 ? 0 : eta_minutes,
    tasks,
    store_status: input.storeStatus,
  };
}

export async function getStoreSyncStatus(
  db: Database,
  storeId: string,
): Promise<SyncStatusResponse | null> {
  const [store] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!store) return null;

  const [latestRun] = await db
    .select()
    .from(syncRuns)
    .where(eq(syncRuns.storeId, storeId))
    .orderBy(desc(syncRuns.startedAt))
    .limit(1);

  const startedAt = latestRun?.startedAt ?? store.createdAt;

  return computeSyncStatus({
    storeId: store.id,
    storeStatus: store.status,
    startedAt,
  });
}
