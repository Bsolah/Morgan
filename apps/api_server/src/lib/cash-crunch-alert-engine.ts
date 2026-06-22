import type { Database } from "@morgan/db";
import type { AlertRecord, AlertSeverity } from "./alerts-data.js";
import { newAlertId } from "./alerts-store.js";
import { maybeSendAlertPush } from "./alerts-push.js";
import { clearAlertByDedupeKey, findAlertByDedupeKey, saveAlert } from "./alerts-repository.js";

export type CashMetrics = {
  cash_balance_usd: number;
  daily_burn_usd: number;
  runway_days: number;
  suggested_actions: string[];
};

export const CASH_CRUNCH_THRESHOLDS = {
  warning_days: 30,
  critical_days: 7,
} as const;

const CASH_CRUNCH_DEDUPE_KEY = "cash_crunch:store";

export function cashCrunchSeverity(runwayDays: number): AlertSeverity | null {
  if (runwayDays < CASH_CRUNCH_THRESHOLDS.critical_days) return "critical";
  if (runwayDays < CASH_CRUNCH_THRESHOLDS.warning_days) return "warning";
  return null;
}

export function qualifiesForCashCrunchAlert(metrics: CashMetrics): boolean {
  return cashCrunchSeverity(metrics.runway_days) !== null;
}

export function formatCashMagnitude(runwayDays: number): string {
  const rounded = Math.max(0, Math.round(runwayDays * 10) / 10);
  return `${rounded} day${rounded === 1 ? "" : "s"} runway`;
}

export function formatUsd(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

export function buildCashCrunchAlert(
  storeId: string,
  metrics: CashMetrics,
  now: Date = new Date(),
): AlertRecord | null {
  const severity = cashCrunchSeverity(metrics.runway_days);
  if (!severity) return null;

  const magnitude = formatCashMagnitude(metrics.runway_days);
  const actionSummary = metrics.suggested_actions.join("; ");
  const title =
    severity === "critical"
      ? `Cash crunch: ${Math.round(metrics.runway_days)} days runway`
      : `Cash runway low: ${Math.round(metrics.runway_days)} days`;

  return {
    id: newAlertId(),
    store_id: storeId,
    severity,
    type: "cash_crunch",
    title,
    body: `Balance ${formatUsd(metrics.cash_balance_usd)} at ${formatUsd(metrics.daily_burn_usd)}/day burn (${magnitude}). Suggested actions: ${actionSummary}.`,
    magnitude,
    top_driver: metrics.suggested_actions[0] ?? "Review cash levers with Morgan",
    links: {
      brief: "/home",
      chat: `/chat?starter=${encodeURIComponent("How can I extend cash runway?")}`,
    },
    metric_snapshot: {
      cash_balance_usd: metrics.cash_balance_usd,
      daily_burn_usd: metrics.daily_burn_usd,
      runway_days: metrics.runway_days,
      suggested_actions: metrics.suggested_actions,
    },
    read_at: null,
    created_at: now.toISOString(),
  };
}

/** Demo cash metrics for stub stores. */
export function sampleCashMetrics(storeId: string): CashMetrics | null {
  if (storeId.endsWith("0002") || storeId === "dev-local-store") {
    return {
      cash_balance_usd: 4100,
      daily_burn_usd: 820,
      runway_days: 5,
      suggested_actions: [
        "Pause discretionary ad spend",
        "Review payables due this week",
        "Ask Morgan for cash levers",
      ],
    };
  }

  return null;
}

export async function evaluateCashCrunchAlert(
  db: Database | null,
  storeId: string,
  metrics: CashMetrics | null = sampleCashMetrics(storeId),
  now: Date = new Date(),
): Promise<AlertRecord | null> {
  const existing = await findAlertByDedupeKey(db, storeId, CASH_CRUNCH_DEDUPE_KEY);

  if (!metrics || !qualifiesForCashCrunchAlert(metrics)) {
    if (existing) {
      await clearAlertByDedupeKey(db, storeId, CASH_CRUNCH_DEDUPE_KEY);
    }
    return null;
  }

  const alert = buildCashCrunchAlert(storeId, metrics, now)!;
  if (existing) {
    alert.id = existing.id;
    alert.read_at = existing.read_at;
    alert.created_at = existing.created_at;
  }

  const saved = await saveAlert(db, alert, CASH_CRUNCH_DEDUPE_KEY);
  await maybeSendAlertPush(db, storeId, saved, now);
  return saved;
}
