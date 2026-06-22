import { getDb } from "./db.js";
import { env } from "../config.js";
import { sendDueWeeklyEmailDigests } from "./weekly-email-digest-service.js";

let interval: NodeJS.Timeout | null = null;
let running = false;

export function startWeeklyEmailDigestRunner(): void {
  if (interval) return;

  const tick = async () => {
    if (running) return;
    const db = getDb();
    if (!db) return;

    running = true;
    try {
      await sendDueWeeklyEmailDigests(db);
    } finally {
      running = false;
    }
  };

  void tick();
  interval = setInterval(() => {
    void tick();
  }, env.WEEKLY_DIGEST_POLL_INTERVAL_MS);
}

export function stopWeeklyEmailDigestRunner(): void {
  if (!interval) return;
  clearInterval(interval);
  interval = null;
}
