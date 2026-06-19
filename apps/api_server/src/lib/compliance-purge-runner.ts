import type { Database } from "@morgan/db";
import { getDb } from "./db.js";
import { processDueShopPurges } from "./shopify-compliance-service.js";
import { env } from "../config.js";

let interval: NodeJS.Timeout | null = null;
let running = false;

export function startCompliancePurgeRunner(): void {
  if (interval) return;

  const tick = async () => {
    if (running) return;
    const db = getDb();
    if (!db) return;

    running = true;
    try {
      await processDueShopPurges(db);
    } finally {
      running = false;
    }
  };

  void tick();
  interval = setInterval(() => {
    void tick();
  }, env.COMPLIANCE_PURGE_POLL_INTERVAL_MS);
}

export function stopCompliancePurgeRunner(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

export async function runCompliancePurgeNow(db: Database): Promise<number> {
  return processDueShopPurges(db);
}
