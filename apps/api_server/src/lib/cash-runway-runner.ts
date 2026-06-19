import { getDb } from "./db.js";
import { recalculateDueCashRunways } from "./cash-runway-service.js";
import { env } from "../config.js";

let interval: NodeJS.Timeout | null = null;
let running = false;

export function startCashRunwayRunner(): void {
  if (interval) return;

  const tick = async () => {
    if (running) return;
    const db = getDb();
    if (!db) return;

    running = true;
    try {
      await recalculateDueCashRunways(db);
    } finally {
      running = false;
    }
  };

  void tick();
  interval = setInterval(() => {
    void tick();
  }, env.CASH_RUNWAY_POLL_INTERVAL_MS);
}

export function stopCashRunwayRunner(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
