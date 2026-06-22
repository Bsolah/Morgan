import type { Database } from "@morgan/db";
import type { AlertRecord, AlertSeverity } from "./alerts-data.js";
import { newAlertId } from "./alerts-store.js";
import { maybeSendAlertPush } from "./alerts-push.js";
import { clearAlertByDedupeKey, findAlertByDedupeKey, saveAlert } from "./alerts-repository.js";
import { sampleMarginMetrics } from "./margin-alert-engine.js";

export type MarginMetrics = {
  current_margin_pct: number;
  trailing_7d_avg_pct: number;
  top_driver: string;
};

const MARGIN_DROP_DEDUPE_KEY = "margin_drop:store";
const MARGIN_DROP_WARNING_THRESHOLD = 0.1;
const MARGIN_DROP_CRITICAL_THRESHOLD = 0.2;

/** Relative margin drop vs 7-day trailing average (0.14 = 14% drop). */
export function computeMarginDropRatio(metrics: MarginMetrics): number {
  if (metrics.trailing_7d_avg_pct <= 0) return 0;
  return (metrics.trailing_7d_avg_pct - metrics.current_margin_pct) / metrics.trailing_7d_avg_pct;
}

export function marginDropSeverity(dropRatio: number): AlertSeverity | null {
  if (dropRatio > MARGIN_DROP_CRITICAL_THRESHOLD) return "critical";
  if (dropRatio > MARGIN_DROP_WARNING_THRESHOLD) return "warning";
  return null;
}

export function formatMarginMagnitude(dropRatio: number, metrics: MarginMetrics): string {
  const pct = Math.round(dropRatio * 100);
  return `${pct}% below 7-day average (${metrics.current_margin_pct.toFixed(1)}% vs ${metrics.trailing_7d_avg_pct.toFixed(1)}%)`;
}

export function buildMarginDropAlert(
  storeId: string,
  metrics: MarginMetrics,
  now: Date = new Date(),
): AlertRecord | null {
  const dropRatio = computeMarginDropRatio(metrics);
  const severity = marginDropSeverity(dropRatio);
  if (!severity) return null;

  const magnitude = formatMarginMagnitude(dropRatio, metrics);

  return {
    id: newAlertId(),
    store_id: storeId,
    severity,
    type: "margin_drop",
    title: `Margin down ${Math.round(dropRatio * 100)}%`,
    body: `${magnitude}. Top driver: ${metrics.top_driver}. Review your daily brief or ask Morgan why.`,
    magnitude,
    top_driver: metrics.top_driver,
    links: {
      brief: "/home",
      chat: `/chat?starter=${encodeURIComponent("Why did margin drop?")}`,
    },
    metric_snapshot: {
      current_margin_pct: metrics.current_margin_pct,
      trailing_7d_avg_pct: metrics.trailing_7d_avg_pct,
      drop_ratio: dropRatio,
    },
    read_at: null,
    created_at: now.toISOString(),
  };
}

/** Demo metrics for stub stores. */
export function sampleMarginMetrics(storeId: string): MarginMetrics {
  if (storeId.endsWith("0002") || storeId === "dev-local-store") {
    return {
      current_margin_pct: 38.2,
      trailing_7d_avg_pct: 44.4,
      top_driver: "Refunds increased $380 vs 7-day average",
    };
  }

  return {
    current_margin_pct: 41.0,
    trailing_7d_avg_pct: 43.5,
    top_driver: "Discount rate up 2.1pp",
  };
}

export async function evaluateMarginDropAlert(
  db: Database | null,
  storeId: string,
  metrics: MarginMetrics = sampleMarginMetrics(storeId),
  now: Date = new Date(),
): Promise<AlertRecord | null> {
  const dropRatio = computeMarginDropRatio(metrics);
  const severity = marginDropSeverity(dropRatio);
  const existing = await findAlertByDedupeKey(db, storeId, MARGIN_DROP_DEDUPE_KEY);

  if (!severity) {
    if (existing) {
      await clearAlertByDedupeKey(db, storeId, MARGIN_DROP_DEDUPE_KEY);
    }
    return null;
  }

  const alert = buildMarginDropAlert(storeId, metrics, now)!;
  if (existing) {
    alert.id = existing.id;
    alert.read_at = existing.read_at;
    alert.created_at = existing.created_at;
  }

  const saved = await saveAlert(db, alert, MARGIN_DROP_DEDUPE_KEY);
  await maybeSendAlertPush(db, storeId, saved, now);
  return saved;
}

export const MARGIN_THRESHOLDS = {
  warning: MARGIN_DROP_WARNING_THRESHOLD,
  critical: MARGIN_DROP_CRITICAL_THRESHOLD,
} as const;
