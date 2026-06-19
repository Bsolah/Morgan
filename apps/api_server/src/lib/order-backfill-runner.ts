import type { Database } from "@morgan/db";
import { getDb } from "./db.js";
import { processActiveOrderBackfillJobs } from "./order-backfill-service.js";

let interval: NodeJS.Timeout | null = null;
let running = false;

export function startOrderBackfillRunner(): void {
  if (interval) return;

  const tick = async () => {
    if (running) return;
    const db = getDb();
    if (!db) return;

    running = true;
    try {
      await processActiveOrderBackfillJobs(db);
    } finally {
      running = false;
    }
  };

  void tick();
  interval = setInterval(() => {
    void tick();
  }, 5_000);
}

export function stopOrderBackfillRunner(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

export async function runOrderBackfillNow(db: Database): Promise<void> {
  await processActiveOrderBackfillJobs(db);
}
