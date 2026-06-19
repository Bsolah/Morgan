import { getDb } from "./db.js";
import { syncGoogleAdsInsightsForConnectedStores } from "./google-ads-insights-sync-service.js";
import { env } from "../config.js";

let interval: NodeJS.Timeout | null = null;
let running = false;

export function startGoogleAdsInsightsSyncRunner(): void {
  if (interval) return;

  const tick = async () => {
    if (running) return;
    if (!env.GOOGLE_ADS_CLIENT_ID || !env.GOOGLE_ADS_DEVELOPER_TOKEN) return;

    const db = getDb();
    if (!db) return;

    running = true;
    try {
      await syncGoogleAdsInsightsForConnectedStores(db);
    } finally {
      running = false;
    }
  };

  void tick();
  interval = setInterval(() => {
    void tick();
  }, env.GOOGLE_ADS_INSIGHTS_SYNC_INTERVAL_MS);
}

export function stopGoogleAdsInsightsSyncRunner(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
