import { addDays } from "../briefing/briefing.js";
import { parseMoneyField } from "../finance/contribution-margin.js";
import { estimateRefundsUsd } from "../finance/margin-decomposition.js";
import { computeMeanAndStdDev } from "../finance/return-drain-leak.js";

export const REFUND_SPIKE_SIGMA_MULTIPLIER = 2;
export const REFUND_SPIKE_MIN_HISTORY_DAYS = 3;

export type RefundSkuImpact = {
  sku: string;
  refund_usd: number;
  units_returned: number;
};

export type RefundSpikeMetrics = {
  rolling_24h_usd: number;
  avg_daily_7d_usd: number;
  stddev_daily_7d_usd: number;
  threshold_usd: number;
  top_skus: RefundSkuImpact[];
};

export type DailyRefundRow = {
  day: string;
  refunds_usd: number;
};

export function estimateDailyRefundsUsd(row: {
  gross_revenue: number;
  discounts: number;
  cogs: number;
  contribution_margin: number;
}): number {
  return estimateRefundsUsd({
    gross_revenue: row.gross_revenue,
    discounts: row.discounts,
    cogs: row.cogs,
    contribution_margin: row.contribution_margin,
    ad_spend: 0,
    shipping_cost: 0,
  });
}

export function computeRolling24hRefundUsd(
  dailyTotals: DailyRefundRow[],
  referenceDay: string,
): number {
  const byDay = new Map(dailyTotals.map((row) => [row.day, row.refunds_usd]));
  const today = byDay.get(referenceDay) ?? 0;
  const yesterday = byDay.get(addDays(referenceDay, -1)) ?? 0;
  return Math.round((today + yesterday * 0.5) * 100) / 100;
}

export function parseLatestRefundUsd(payload: Record<string, unknown>): number {
  const refunds = payload.refunds;
  if (!Array.isArray(refunds) || refunds.length === 0) return 0;

  const latest = refunds[refunds.length - 1];
  if (!latest || typeof latest !== "object") return 0;
  const record = latest as Record<string, unknown>;

  const transactions = record.transactions;
  if (Array.isArray(transactions)) {
    return Math.round(
      transactions.reduce((sum, txn) => {
        if (!txn || typeof txn !== "object") return sum;
        return sum + parseMoneyField((txn as Record<string, unknown>).amount);
      }, 0) * 100,
    ) / 100;
  }

  return Math.round(parseMoneyField(record.amount ?? record.total_refunded) * 100) / 100;
}

function buildLineItemSkuMap(
  payload: Record<string, unknown>,
): Map<string, { sku: string; quantity: number }> {
  const lineItems = payload.line_items ?? payload.lineItems;
  const map = new Map<string, { sku: string; quantity: number }>();
  if (!Array.isArray(lineItems)) return map;

  for (const line of lineItems) {
    if (!line || typeof line !== "object") continue;
    const record = line as Record<string, unknown>;
    const lineId = record.id != null ? String(record.id) : null;
    const sku = typeof record.sku === "string" ? record.sku.trim() : "";
    if (!lineId || !sku) continue;
    const quantity = Number(record.quantity ?? 0);
    map.set(lineId, { sku, quantity: Number.isFinite(quantity) ? quantity : 0 });
  }

  return map;
}

export function extractTopAffectedSkus(
  payload: Record<string, unknown>,
  limit = 3,
): RefundSkuImpact[] {
  const refunds = payload.refunds;
  if (!Array.isArray(refunds) || refunds.length === 0) return [];

  const latest = refunds[refunds.length - 1];
  if (!latest || typeof latest !== "object") return [];

  const lineItems = buildLineItemSkuMap(payload);
  const bySku = new Map<string, RefundSkuImpact>();
  const record = latest as Record<string, unknown>;
  const refundLineItems = record.refund_line_items ?? record.refundLineItems;

  if (Array.isArray(refundLineItems)) {
    for (const refundLine of refundLineItems) {
      if (!refundLine || typeof refundLine !== "object") continue;
      const line = refundLine as Record<string, unknown>;
      const lineItemId = line.line_item_id ?? line.lineItemId;
      const mapped = lineItemId != null ? lineItems.get(String(lineItemId)) : undefined;
      const sku =
        mapped?.sku ??
        (typeof line.sku === "string" && line.sku.trim().length > 0 ? line.sku.trim() : null);
      if (!sku) continue;

      const quantity = Number(line.quantity ?? 0);
      const refundUsd = parseMoneyField(line.subtotal ?? line.total);
      const existing = bySku.get(sku) ?? { sku, refund_usd: 0, units_returned: 0 };
      bySku.set(sku, {
        sku,
        refund_usd: Math.round((existing.refund_usd + refundUsd) * 100) / 100,
        units_returned: existing.units_returned + (Number.isFinite(quantity) ? quantity : 0),
      });
    }
  } else {
    const refundUsd = parseLatestRefundUsd(payload);
    if (refundUsd > 0 && lineItems.size === 1) {
      const [sku] = [...lineItems.values()].map((item) => item.sku);
      if (sku) {
        bySku.set(sku, { sku, refund_usd: refundUsd, units_returned: 1 });
      }
    }
  }

  return [...bySku.values()]
    .sort((left, right) => right.refund_usd - left.refund_usd)
    .slice(0, limit);
}

export function qualifiesForRefundSpikeAlert(input: {
  rolling_24h_usd: number;
  daily_refunds_7d: number[];
}): boolean {
  if (input.daily_refunds_7d.length < REFUND_SPIKE_MIN_HISTORY_DAYS) return false;
  if (input.rolling_24h_usd <= 0) return false;

  const { mean, stddev } = computeMeanAndStdDev(input.daily_refunds_7d);
  const threshold = mean + REFUND_SPIKE_SIGMA_MULTIPLIER * stddev;
  return input.rolling_24h_usd > threshold;
}

export function buildRefundSpikeMetrics(input: {
  dailyTotals: DailyRefundRow[];
  referenceDay: string;
  topSkus: RefundSkuImpact[];
  webhookRefundUsd?: number;
}): RefundSpikeMetrics {
  const adjustedTotals = input.dailyTotals.map((row) => ({ ...row }));
  if (input.webhookRefundUsd != null && input.webhookRefundUsd > 0) {
    const todayIndex = adjustedTotals.findIndex((row) => row.day === input.referenceDay);
    if (todayIndex >= 0) {
      adjustedTotals[todayIndex] = {
        ...adjustedTotals[todayIndex]!,
        refunds_usd:
          Math.round((adjustedTotals[todayIndex]!.refunds_usd + input.webhookRefundUsd) * 100) /
          100,
      };
    } else {
      adjustedTotals.push({
        day: input.referenceDay,
        refunds_usd: input.webhookRefundUsd,
      });
    }
  }

  const historyDays = adjustedTotals
    .filter((row) => row.day < input.referenceDay)
    .slice(-7)
    .map((row) => row.refunds_usd);

  const rolling24hUsd = computeRolling24hRefundUsd(adjustedTotals, input.referenceDay);
  const { mean, stddev } = computeMeanAndStdDev(historyDays);

  return {
    rolling_24h_usd: rolling24hUsd,
    avg_daily_7d_usd: Math.round(mean * 100) / 100,
    stddev_daily_7d_usd: Math.round(stddev * 100) / 100,
    threshold_usd: Math.round((mean + REFUND_SPIKE_SIGMA_MULTIPLIER * stddev) * 100) / 100,
    top_skus: input.topSkus,
  };
}

export function formatRefundSpikeMagnitude(metrics: RefundSpikeMetrics): string {
  return `$${Math.round(metrics.rolling_24h_usd).toLocaleString("en-US")} refunds (24h) vs $${Math.round(metrics.avg_daily_7d_usd).toLocaleString("en-US")} daily avg`;
}

export function formatTopAffectedSkus(skus: RefundSkuImpact[]): string {
  if (skus.length === 0) return "Review recent refund activity";
  return skus
    .map((sku) => `${sku.sku} ($${Math.round(sku.refund_usd).toLocaleString("en-US")})`)
    .join(", ");
}

export function buildRefundSpikeBody(metrics: RefundSpikeMetrics): string {
  const skuLine = formatTopAffectedSkus(metrics.top_skus);
  return `${formatRefundSpikeMagnitude(metrics)} — above the 7-day trend (+${REFUND_SPIKE_SIGMA_MULTIPLIER}σ). Top SKUs: ${skuLine}. Review returns and product quality before margin erodes further.`;
}
