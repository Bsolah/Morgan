import type { AlertsResponse } from "./alerts-data.js";
import { countUnreadAlerts, listStoreAlerts } from "./alerts-store.js";
import { evaluateAdWasteAlerts } from "./ad-waste-alert-engine.js";
import { evaluateCashCrunchAlert } from "./cash-crunch-alert-engine.js";
import { evaluateMarginDropAlert } from "./margin-alert-engine.js";
import { evaluateStockoutAlerts } from "./stockout-alert-engine.js";

export function getStoreAlerts(storeId: string): AlertsResponse {
  // Evaluate latest signals on each fetch until batch jobs land.
  evaluateMarginDropAlert(storeId);
  evaluateAdWasteAlerts(storeId);
  evaluateStockoutAlerts(storeId);
  evaluateCashCrunchAlert(storeId);

  const alerts = listStoreAlerts(storeId);
  return {
    alerts,
    unread_count: countUnreadAlerts(storeId),
  };
}
