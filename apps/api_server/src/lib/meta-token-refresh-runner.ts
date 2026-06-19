import { getDb } from "./db.js";
import { refreshMetaTokens } from "./meta-integration-service.js";
import { env } from "../config.js";

let interval: NodeJS.Timeout | null = null;
let running = false;

export function startMetaTokenRefreshRunner(): void {
  if (interval) return;

  const tick = async () => {
    if (running) return;
    if (!env.META_APP_ID || !env.META_APP_SECRET) return;

    const db = getDb();
    if (!db) return;

    running = true;
    try {
      await refreshMetaTokens(db, {
        encryptionKey: env.ENCRYPTION_KEY,
        appId: env.META_APP_ID,
        appSecret: env.META_APP_SECRET,
        refreshWithinMs: env.META_TOKEN_REFRESH_WITHIN_MS,
      });
    } finally {
      running = false;
    }
  };

  void tick();
  interval = setInterval(() => {
    void tick();
  }, env.META_TOKEN_REFRESH_INTERVAL_MS);
}

export function stopMetaTokenRefreshRunner(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
