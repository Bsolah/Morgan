import type { Database } from "@morgan/db";
import { getDb } from "./db.js";
import { pollShopifyPayments } from "./payout-sync-service.js";
import { env } from "../config.js";

let interval: NodeJS.Timeout | null = null;
let running = false;

export function startPayoutSyncRunner(): void {
  if (interval) return;

  const tick = async () => {
    if (running) return;
    const db = getDb();
    if (!db) return;

    running = true;
    try {
      await pollShopifyPayments(db);
    } finally {
      running = false;
    }
  };

  void tick();
  interval = setInterval(() => {
    void tick();
  }, env.PAYOUT_POLL_INTERVAL_MS);
}

export function stopPayoutSyncRunner(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

export async function runPayoutSyncNow(db: Database, storeId?: string): Promise<void> {
  await pollShopifyPayments(db, storeId);
}
