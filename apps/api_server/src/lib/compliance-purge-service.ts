import { rm } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { stores, type Database } from "@morgan/db";
import { env } from "../config.js";

const STORE_SCOPED_PATHS = [
  "shopify_orders",
  "dim_products",
  "inventory_levels",
  "fact_order_lines",
  "mart_cash_daily",
  "mart_ad_performance",
  "meta_insights_daily",
] as const;

const BRONZE_EVENT_SOURCES = [
  "shopify",
  "meta",
  "plaid",
  "quickbooks",
  "google_ads",
  "xero",
  "morgan",
] as const;

export async function purgeStoreFilesystemData(storeId: string): Promise<void> {
  const roots = [env.BRONZE_STORAGE_PATH, env.CLICKHOUSE_STORAGE_PATH, env.DEAD_LETTER_STORAGE_PATH];

  for (const root of roots) {
    for (const segment of STORE_SCOPED_PATHS) {
      const target = path.join(root, segment, storeId);
      await rm(target, { recursive: true, force: true });
    }

    for (const source of BRONZE_EVENT_SOURCES) {
      await rm(path.join(root, source, storeId), { recursive: true, force: true });
    }
  }
}

export async function purgeStoreData(db: Database, storeId: string): Promise<void> {
  await purgeStoreFilesystemData(storeId);
  await db.delete(stores).where(eq(stores.id, storeId));
}
