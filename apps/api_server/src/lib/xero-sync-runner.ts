import { getDb } from "./db.js";
import { syncXeroBooksForConnectedStores } from "./xero-sync-service.js";
import { env } from "../config.js";

let interval: NodeJS.Timeout | null = null;
let running = false;

export function startXeroSyncRunner(): void {
  if (interval) return;

  const tick = async () => {
    if (running) return;
    if (!env.XERO_CLIENT_ID || !env.XERO_CLIENT_SECRET) return;

    const db = getDb();
    if (!db) return;

    running = true;
    try {
      await syncXeroBooksForConnectedStores(db);
    } finally {
      running = false;
    }
  };

  void tick();
  interval = setInterval(() => {
    void tick();
  }, env.XERO_SYNC_INTERVAL_MS);
}

export function stopXeroSyncRunner(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
