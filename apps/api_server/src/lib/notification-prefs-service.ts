import { eq } from "drizzle-orm";
import { merchantFinanceConfig, type Database } from "@morgan/db";
import {
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefs,
} from "./alerts-data.js";

function mergeNotificationPrefs(stored: unknown): NotificationPrefs {
  if (!stored || typeof stored !== "object") {
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }

  const partial = stored as Partial<NotificationPrefs>;
  return {
    ...DEFAULT_NOTIFICATION_PREFS,
    ...partial,
  };
}

async function ensureFinanceConfigRow(db: Database, storeId: string) {
  const [existing] = await db
    .select()
    .from(merchantFinanceConfig)
    .where(eq(merchantFinanceConfig.storeId, storeId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(merchantFinanceConfig)
    .values({ storeId })
    .returning();

  return created!;
}

export async function getStoreNotificationPrefs(
  db: Database,
  storeId: string,
): Promise<NotificationPrefs> {
  const row = await ensureFinanceConfigRow(db, storeId);
  return mergeNotificationPrefs(row.notificationPrefs);
}

export async function updateStoreNotificationPrefs(
  db: Database,
  storeId: string,
  patch: Partial<NotificationPrefs>,
): Promise<NotificationPrefs> {
  const current = await getStoreNotificationPrefs(db, storeId);
  const merged = { ...current, ...patch };

  await db
    .insert(merchantFinanceConfig)
    .values({
      storeId,
      notificationPrefs: merged,
    })
    .onConflictDoUpdate({
      target: merchantFinanceConfig.storeId,
      set: {
        notificationPrefs: merged,
        updatedAt: new Date(),
      },
    });

  return merged;
}
