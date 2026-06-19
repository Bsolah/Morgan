import { getDb } from "./db.js";
import { refreshGoogleAdsTokens } from "./google-ads-integration-service.js";
import { env } from "../config.js";

let interval: NodeJS.Timeout | null = null;
let running = false;

export function startGoogleAdsTokenRefreshRunner(): void {
  if (interval) return;

  const tick = async () => {
    if (running) return;
    if (!env.GOOGLE_ADS_CLIENT_ID || !env.GOOGLE_ADS_CLIENT_SECRET) return;

    const db = getDb();
    if (!db) return;

    running = true;
    try {
      await refreshGoogleAdsTokens(db, {
        encryptionKey: env.ENCRYPTION_KEY,
        clientId: env.GOOGLE_ADS_CLIENT_ID,
        clientSecret: env.GOOGLE_ADS_CLIENT_SECRET,
        refreshWithinMs: env.GOOGLE_ADS_TOKEN_REFRESH_WITHIN_MS,
      });
    } finally {
      running = false;
    }
  };

  void tick();
  interval = setInterval(() => {
    void tick();
  }, env.GOOGLE_ADS_TOKEN_REFRESH_INTERVAL_MS);
}

export function stopGoogleAdsTokenRefreshRunner(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
