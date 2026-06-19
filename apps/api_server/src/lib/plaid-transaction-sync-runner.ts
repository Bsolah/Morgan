import { getDb } from "./db.js";
import { syncPlaidTransactionsForConnectedStores } from "./plaid-transaction-sync-service.js";
import { env } from "../config.js";

let interval: NodeJS.Timeout | null = null;
let running = false;

export function startPlaidTransactionSyncRunner(): void {
  if (interval) return;

  const tick = async () => {
    if (running) return;
    const db = getDb();
    if (!db) return;

    running = true;
    try {
      await syncPlaidTransactionsForConnectedStores(db);
    } finally {
      running = false;
    }
  };

  void tick();
  interval = setInterval(() => {
    void tick();
  }, env.PLAID_SYNC_INTERVAL_MS);
}

export function stopPlaidTransactionSyncRunner(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
