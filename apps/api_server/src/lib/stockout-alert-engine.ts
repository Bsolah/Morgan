import type { Database } from "@morgan/db";
import type { AlertRecord, AlertSeverity } from "./alerts-data.js";
import { newAlertId } from "./alerts-store.js";
import { maybeSendAlertPush } from "./alerts-push.js";
import { clearAlertByDedupeKey, findAlertByDedupeKey, listAlerts, saveAlert } from "./alerts-repository.js";

export type SkuInventoryMetrics = {
  sku_id: string;
  sku_name: string;
  days_of_stock: number;
  lead_time_days: number;
  /** Revenue percentile 0–100; top 20% SKUs are >= 80. */
  revenue_percentile: number;
  recommendation_id: string;
};

export const STOCKOUT_THRESHOLDS = {
  top_revenue_percentile: 80,
  lead_time_buffer_days: 3,
  warning_days: 7,
  critical_days: 3,
} as const;

export function stockoutRiskThresholdDays(leadTimeDays: number): number {
  return leadTimeDays + STOCKOUT_THRESHOLDS.lead_time_buffer_days;
}

export function isTopRevenueSku(revenuePercentile: number): boolean {
  return revenuePercentile >= STOCKOUT_THRESHOLDS.top_revenue_percentile;
}

/** True when a top-revenue SKU will run out before reorder lead time plus buffer. */
export function qualifiesForStockoutAlert(metrics: SkuInventoryMetrics): boolean {
  if (!isTopRevenueSku(metrics.revenue_percentile)) return false;
  return metrics.days_of_stock < stockoutRiskThresholdDays(metrics.lead_time_days);
}

export function stockoutSeverity(daysOfStock: number): AlertSeverity {
  if (daysOfStock < STOCKOUT_THRESHOLDS.critical_days) return "critical";
  if (daysOfStock < STOCKOUT_THRESHOLDS.warning_days) return "warning";
  return "info";
}

export function formatStockoutMagnitude(daysOfStock: number): string {
  const rounded = Math.max(0, Math.round(daysOfStock));
  return `~${rounded} day${rounded === 1 ? "" : "s"} remaining`;
}

export function buildStockoutAlert(
  storeId: string,
  metrics: SkuInventoryMetrics,
  now: Date = new Date(),
): AlertRecord | null {
  if (!qualifiesForStockoutAlert(metrics)) return null;

  const magnitude = formatStockoutMagnitude(metrics.days_of_stock);
  const threshold = stockoutRiskThresholdDays(metrics.lead_time_days);

  return {
    id: newAlertId(),
    store_id: storeId,
    severity: stockoutSeverity(metrics.days_of_stock),
    type: "stockout_risk",
    title: `Stockout risk: ${metrics.sku_name}`,
    body: `${metrics.sku_name} has ${magnitude.replace("~", "")} at current velocity (${metrics.lead_time_days}-day supplier lead time). Reorder now to avoid lost sales.`,
    magnitude,
    top_driver: `Below ${threshold}-day reorder window (lead time + 3 days)`,
    links: {
      recommendation: `/recommendations/${metrics.recommendation_id}`,
    },
    metric_snapshot: {
      sku_id: metrics.sku_id,
      sku_name: metrics.sku_name,
      days_of_stock: metrics.days_of_stock,
      lead_time_days: metrics.lead_time_days,
      reorder_threshold_days: threshold,
      revenue_percentile: metrics.revenue_percentile,
      recommendation_id: metrics.recommendation_id,
    },
    read_at: null,
    created_at: now.toISOString(),
  };
}

/** Demo SKUs for stub stores. */
export function sampleSkuInventoryMetrics(storeId: string): SkuInventoryMetrics[] {
  if (storeId.endsWith("0002") || storeId === "dev-local-store") {
    return [
      {
        sku_id: "sku_blue_tee_m",
        sku_name: "Blue Tee (M)",
        days_of_stock: 6,
        lead_time_days: 10,
        revenue_percentile: 92,
        recommendation_id: "rec-002",
      },
    ];
  }

  return [];
}

function stockoutDedupeKey(skuId: string): string {
  return `stockout_risk:${skuId}`;
}

export async function evaluateStockoutAlerts(
  db: Database | null,
  storeId: string,
  skus: SkuInventoryMetrics[] = sampleSkuInventoryMetrics(storeId),
  now: Date = new Date(),
): Promise<AlertRecord[]> {
  const created: AlertRecord[] = [];
  const activeKeys = new Set<string>();

  for (const metrics of skus) {
    const dedupeKey = stockoutDedupeKey(metrics.sku_id);
    const alert = buildStockoutAlert(storeId, metrics, now);
    if (!alert) {
      await clearAlertByDedupeKey(db, storeId, dedupeKey);
      continue;
    }

    activeKeys.add(dedupeKey);
    const existing = await findAlertByDedupeKey(db, storeId, dedupeKey);
    if (existing) {
      alert.id = existing.id;
      alert.read_at = existing.read_at;
      alert.created_at = existing.created_at;
    }

    const saved = await saveAlert(db, alert, dedupeKey);
    await maybeSendAlertPush(db, storeId, saved, now);
    created.push(saved);
  }

  const existingAlerts = await listAlerts(db, storeId);
  for (const alert of existingAlerts) {
    if (alert.type !== "stockout_risk") continue;
    const skuId = String(alert.metric_snapshot.sku_id ?? "");
    const dedupeKey = stockoutDedupeKey(skuId);
    if (!activeKeys.has(dedupeKey)) {
      await clearAlertByDedupeKey(db, storeId, dedupeKey);
    }
  }

  return created;
}
