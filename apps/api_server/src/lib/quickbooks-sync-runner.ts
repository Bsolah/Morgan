import { getDb } from "./db.js";
import { syncQuickBooksBooksForConnectedStores } from "./quickbooks-sync-service.js";
import { env } from "../config.js";

let interval: NodeJS.Timeout | null = null;
let running = false;

export function startQuickBooksSyncRunner(): void {
  if (interval) return;

  const tick = async () => {
    if (running) return;
    if (!env.INTUIT_CLIENT_ID || !env.INTUIT_CLIENT_SECRET) return;

    const db = getDb();
    if (!db) return;

    running = true;
    try {
      await syncQuickBooksBooksForConnectedStores(db);
    } finally {
      running = false;
    }
  };

  void tick();
  interval = setInterval(() => {
    void tick();
  }, env.INTUIT_SYNC_INTERVAL_MS);
}

export function stopQuickBooksSyncRunner(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
