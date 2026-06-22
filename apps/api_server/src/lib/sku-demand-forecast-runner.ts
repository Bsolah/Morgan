import { getDb } from "./db.js";
import { refreshDueSkuDemandForecasts } from "./sku-demand-forecast-service.js";
import { env } from "../config.js";

let interval: NodeJS.Timeout | null = null;
let running = false;

export function startSkuDemandForecastRunner(): void {
  if (interval) return;

  const tick = async () => {
    if (running) return;
    const db = getDb();
    if (!db) return;

    running = true;
    try {
      await refreshDueSkuDemandForecasts(db);
    } finally {
      running = false;
    }
  };

  void tick();
  interval = setInterval(() => {
    void tick();
  }, env.SKU_DEMAND_FORECAST_POLL_INTERVAL_MS);
}

export function stopSkuDemandForecastRunner(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
