import type { Database } from "@morgan/db";
import type { AlertsResponse } from "./alerts-data.js";
import { evaluateAdWasteAlerts } from "./ad-waste-alert-engine.js";
import { evaluateCashCrunchAlert } from "./cash-crunch-alert-engine.js";
import { evaluateMarginDropAlert } from "./margin-alert-engine.js";
import { evaluateStockoutAlerts } from "./stockout-alert-engine.js";
import {
  loadCampaignMetricsForAlerts,
  loadCashMetricsForAlerts,
  loadMarginMetricsForAlerts,
  loadSkuInventoryMetricsForAlerts,
} from "./alerts-metrics-loader.js";
import { countUnread, listAlerts } from "./alerts-repository.js";

export async function evaluateStoreAlerts(
  db: Database | null,
  storeId: string,
  now = new Date(),
): Promise<void> {
  const marginMetrics = db
    ? await loadMarginMetricsForAlerts(db, storeId)
    : undefined;
  const campaigns = db ? await loadCampaignMetricsForAlerts(db, storeId) : undefined;
  const skus = db ? await loadSkuInventoryMetricsForAlerts(db, storeId) : undefined;
  const cashMetrics = db ? await loadCashMetricsForAlerts(db, storeId) : undefined;

  await evaluateMarginDropAlert(db, storeId, marginMetrics, now);
  await evaluateAdWasteAlerts(db, storeId, campaigns, now);
  await evaluateStockoutAlerts(db, storeId, skus, now);
  await evaluateCashCrunchAlert(db, storeId, cashMetrics, now);
}

export async function getStoreAlerts(
  db: Database | null,
  storeId: string,
): Promise<AlertsResponse> {
  await evaluateStoreAlerts(db, storeId);

  const alertList = await listAlerts(db, storeId);
  return {
    alerts: alertList,
    unread_count: await countUnread(db, storeId),
  };
}
