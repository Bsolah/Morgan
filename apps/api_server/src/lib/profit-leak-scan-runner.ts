import { getDb } from "./db.js";
import { scanDueProfitLeakScans } from "./profit-leak-scan-service.js";
import { env } from "../config.js";

let interval: NodeJS.Timeout | null = null;
let running = false;

export function startProfitLeakScanRunner(): void {
  if (interval) return;

  const tick = async () => {
    if (running) return;
    const db = getDb();
    if (!db) return;

    running = true;
    try {
      await scanDueProfitLeakScans(db);
    } finally {
      running = false;
    }
  };

  void tick();
  interval = setInterval(() => {
    void tick();
  }, env.LEAK_SCAN_POLL_INTERVAL_MS);
}

export function stopProfitLeakScanRunner(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
