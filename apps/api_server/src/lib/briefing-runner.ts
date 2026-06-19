import { getDb } from "./db.js";
import { generateDueDailyBriefings } from "./briefing-generation-service.js";
import { env } from "../config.js";

let interval: NodeJS.Timeout | null = null;
let running = false;

export function startBriefingRunner(): void {
  if (interval) return;

  const tick = async () => {
    if (running) return;
    const db = getDb();
    if (!db) return;

    running = true;
    try {
      await generateDueDailyBriefings(db);
    } finally {
      running = false;
    }
  };

  void tick();
  interval = setInterval(() => {
    void tick();
  }, env.BRIEFING_POLL_INTERVAL_MS);
}

export function stopBriefingRunner(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
