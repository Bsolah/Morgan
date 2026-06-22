import { getDb } from "./db.js";
import { refreshDueRevenueForecasts } from "./revenue-forecast-service.js";
import { env } from "../config.js";

let interval: NodeJS.Timeout | null = null;
let running = false;

export function startRevenueForecastRunner(): void {
  if (interval) return;

  const tick = async () => {
    if (running) return;
    const db = getDb();
    if (!db) return;

    running = true;
    try {
      await refreshDueRevenueForecasts(db);
    } finally {
      running = false;
    }
  };

  void tick();
  interval = setInterval(() => {
    void tick();
  }, env.REVENUE_FORECAST_POLL_INTERVAL_MS);
}

export function stopRevenueForecastRunner(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
