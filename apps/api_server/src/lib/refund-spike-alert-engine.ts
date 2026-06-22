import { addDays, merchantLocalDay } from "@morgan/integrations";
import type { Database } from "@morgan/db";
import type { AlertRecord } from "./alerts-data.js";
import { newAlertId } from "./alerts-store.js";
import { maybeSendAlertPush } from "./alerts-push.js";
import { clearAlertByDedupeKey, findAlertByDedupeKey, saveAlert } from "./alerts-repository.js";
import {
  buildRefundSpikeBody,
  buildRefundSpikeMetrics,
  extractTopAffectedSkus,
  formatRefundSpikeMagnitude,
  formatTopAffectedSkus,
  parseLatestRefundUsd,
  qualifiesForRefundSpikeAlert,
  type RefundSpikeMetrics,
} from "@morgan/integrations";
import { loadRefundSpikeDailyTotals } from "./refund-spike-metrics-loader.js";
import { STUB_STORE_ID } from "../test/stub-store.js";

export type { RefundSpikeMetrics };

const REFUND_SPIKE_DEDUPE_PREFIX = "refund_spike:store";

function refundSpikeDedupeKey(referenceDay: string): string {
  return `${REFUND_SPIKE_DEDUPE_PREFIX}:${referenceDay}`;
}

export function sampleRefundSpikeMetrics(): RefundSpikeMetrics {
  return {
    rolling_24h_usd: 820,
    avg_daily_7d_usd: 180,
    stddev_daily_7d_usd: 45,
    threshold_usd: 270,
    top_skus: [
      { sku: "TEE-BLU-M", refund_usd: 240, units_returned: 6 },
      { sku: "HOOD-GRY-L", refund_usd: 180, units_returned: 3 },
    ],
  };
}

export function buildRefundSpikeAlert(
  storeId: string,
  metrics: RefundSpikeMetrics,
  now: Date = new Date(),
): AlertRecord {
  const topDriver = formatTopAffectedSkus(metrics.top_skus);

  return {
    id: newAlertId(),
    store_id: storeId,
    severity: "warning",
    type: "refund_spike",
    title: "Refund spike detected",
    body: buildRefundSpikeBody(metrics),
    magnitude: formatRefundSpikeMagnitude(metrics),
    top_driver: topDriver,
    links: {
      brief: "/home",
      chat: `/chat?starter=${encodeURIComponent("Why did refunds spike today?")}`,
    },
    metric_snapshot: {
      rolling_24h_usd: metrics.rolling_24h_usd,
      avg_daily_7d_usd: metrics.avg_daily_7d_usd,
      stddev_daily_7d_usd: metrics.stddev_daily_7d_usd,
      threshold_usd: metrics.threshold_usd,
      top_skus: metrics.top_skus,
    },
    read_at: null,
    created_at: now.toISOString(),
  };
}

function isDemoStore(storeId: string): boolean {
  return storeId === STUB_STORE_ID || storeId.endsWith("0002") || storeId === "dev-local-store";
}

export async function evaluateRefundSpikeAlert(
  db: Database | null,
  storeId: string,
  input: {
    payload: Record<string, unknown>;
    referenceDay?: string;
    timezone?: string;
    receivedAt?: Date;
  },
  now: Date = new Date(),
): Promise<AlertRecord | null> {
  const timezone = input.timezone ?? "UTC";
  const referenceDay = input.referenceDay ?? merchantLocalDay(timezone, input.receivedAt ?? now);
  const dedupeKey = refundSpikeDedupeKey(referenceDay);

  const topSkus = extractTopAffectedSkus(input.payload);
  const webhookRefundUsd = parseLatestRefundUsd(input.payload);

  let metrics: RefundSpikeMetrics;
  let historyDays: number[];

  if (isDemoStore(storeId)) {
    metrics = {
      ...sampleRefundSpikeMetrics(),
      top_skus: topSkus.length > 0 ? topSkus : sampleRefundSpikeMetrics().top_skus,
    };
    historyDays = [180, 190, 175, 185, 180, 170, 195];
  } else {
    const dailyTotals = db ? await loadRefundSpikeDailyTotals(db, storeId, referenceDay) : [];
    metrics = buildRefundSpikeMetrics({
      dailyTotals,
      referenceDay,
      topSkus,
      webhookRefundUsd,
    });
    historyDays = dailyTotals
      .filter((row) => row.day < referenceDay)
      .slice(-7)
      .map((row) => row.refunds_usd);
  }

  const qualifies = isDemoStore(storeId)
    ? webhookRefundUsd > 0 || topSkus.length > 0
    : qualifiesForRefundSpikeAlert({
        rolling_24h_usd: metrics.rolling_24h_usd,
        daily_refunds_7d: historyDays,
      });

  const existing = await findAlertByDedupeKey(db, storeId, dedupeKey);

  if (!qualifies) {
    if (existing) {
      await clearAlertByDedupeKey(db, storeId, dedupeKey);
    }
    return null;
  }

  const alert = buildRefundSpikeAlert(storeId, metrics, now);
  if (existing) {
    alert.id = existing.id;
    alert.read_at = existing.read_at;
    alert.created_at = existing.created_at;
  }

  const saved = await saveAlert(db, alert, dedupeKey);
  await maybeSendAlertPush(db, storeId, saved, now);
  return saved;
}

export async function evaluateRefundSpikeOnWebhook(
  db: Database | null,
  storeId: string,
  payload: Record<string, unknown>,
  receivedAt: Date,
): Promise<AlertRecord | null> {
  return evaluateRefundSpikeAlert(db, storeId, { payload, receivedAt }, receivedAt);
}
