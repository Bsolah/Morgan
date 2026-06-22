import { extractOrderDay, parseMoneyField } from "./contribution-margin.js";
import { isOrderCancelled } from "./discount-bleed-leak.js";

export const RETURN_DRAIN_THRESHOLDS = {
  window_days: 30,
  min_returns: 10,
  sigma_multiplier: 2,
  top_return_reasons_limit: 3,
} as const;

export type SkuReturnActivity = {
  day: string;
  order_id: string;
  sku: string;
  category: string;
  units_sold: number;
  units_returned: number;
  return_usd: number;
  return_reasons: string[];
};

export type SkuReturnMetrics = {
  sku: string;
  category: string;
  units_sold: number;
  units_returned: number;
  return_usd: number;
  return_rate: number;
  return_reason_counts: Map<string, number>;
};

export type CategoryReturnBenchmark = {
  category: string;
  mean_return_rate: number;
  stddev_return_rate: number;
  sku_count: number;
};

export type ReturnDrainEvidence = {
  sku: string;
  category: string;
  return_rate_pct: number;
  category_mean_return_rate_pct: number;
  category_return_rate_stddev_pct: number;
  returns_usd: number;
  returns_count: number;
  top_return_reasons: string[];
};

export type ReturnDrainEvaluation = {
  sku: string;
  qualifies: boolean;
  should_resolve: boolean;
  amount_at_risk_usd: number;
  evidence: ReturnDrainEvidence | null;
};

export function resolveSkuCategory(sku: string, categoryBySku?: Map<string, string>): string {
  const mapped = categoryBySku?.get(sku);
  if (mapped && mapped.length > 0) return mapped;

  const prefix = sku.split(/[-_]/)[0]?.trim();
  return prefix && prefix.length > 0 ? prefix.toUpperCase() : "uncategorized";
}

export function computeMeanAndStdDev(values: number[]): { mean: number; stddev: number } {
  if (values.length === 0) {
    return { mean: 0, stddev: 0 };
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (values.length === 1) {
    return { mean, stddev: 0 };
  }

  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return { mean, stddev: Math.sqrt(variance) };
}

function buildLineItemSkuMap(
  payload: Record<string, unknown>,
): Map<string, { sku: string; quantity: number; line_gross_usd: number }> {
  const lineItems = payload.line_items ?? payload.lineItems;
  const map = new Map<string, { sku: string; quantity: number; line_gross_usd: number }>();
  if (!Array.isArray(lineItems)) return map;

  for (const line of lineItems) {
    if (!line || typeof line !== "object") continue;
    const record = line as Record<string, unknown>;
    const lineId = record.id != null ? String(record.id) : null;
    const sku = typeof record.sku === "string" ? record.sku.trim() : "";
    if (!lineId || !sku) continue;

    const quantity = Number(record.quantity ?? 0);
    const unitPrice = parseMoneyField(record.price ?? record.originalUnitPriceSet);
    map.set(lineId, {
      sku,
      quantity: Number.isFinite(quantity) ? quantity : 0,
      line_gross_usd: unitPrice * (Number.isFinite(quantity) ? quantity : 0),
    });
  }

  return map;
}

function extractRefundReason(refund: Record<string, unknown>): string | null {
  const note = refund.note;
  if (typeof note === "string" && note.trim().length > 0) {
    return note.trim();
  }

  const returnRecord = refund.return;
  if (returnRecord && typeof returnRecord === "object") {
    const reason = (returnRecord as Record<string, unknown>).reason;
    if (typeof reason === "string" && reason.trim().length > 0) {
      return reason.trim();
    }
  }

  return null;
}

export function parseOrderSkuReturnActivity(
  payload: Record<string, unknown>,
  orderId: string,
  categoryBySku?: Map<string, string>,
): SkuReturnActivity[] {
  if (isOrderCancelled(payload)) return [];

  const day = extractOrderDay(payload);
  if (!day) return [];

  const lineItems = buildLineItemSkuMap(payload);
  const activities: SkuReturnActivity[] = [];

  for (const item of lineItems.values()) {
    if (item.quantity <= 0) continue;
    activities.push({
      day,
      order_id: orderId,
      sku: item.sku,
      category: resolveSkuCategory(item.sku, categoryBySku),
      units_sold: item.quantity,
      units_returned: 0,
      return_usd: 0,
      return_reasons: [],
    });
  }

  const refunds = payload.refunds;
  if (!Array.isArray(refunds)) return activities;

  const soldBySku = new Map<string, number>();
  for (const item of lineItems.values()) {
    soldBySku.set(item.sku, (soldBySku.get(item.sku) ?? 0) + item.quantity);
  }

  for (const refund of refunds) {
    if (!refund || typeof refund !== "object") continue;
    const record = refund as Record<string, unknown>;
    const reason = extractRefundReason(record);
    const refundLineItems = record.refund_line_items ?? record.refundLineItems;

    if (Array.isArray(refundLineItems) && refundLineItems.length > 0) {
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
        if (!Number.isFinite(quantity) || quantity <= 0) continue;

        const subtotal = parseMoneyField(line.subtotal ?? line.total);
        activities.push({
          day,
          order_id: orderId,
          sku,
          category: resolveSkuCategory(sku, categoryBySku),
          units_sold: 0,
          units_returned: quantity,
          return_usd: subtotal,
          return_reasons: reason ? [reason] : [],
        });
      }
      continue;
    }

    const refundAmount = parseMoneyField(record.amount ?? record.total_refunded);
    if (refundAmount <= 0 || soldBySku.size === 0) continue;

    if (soldBySku.size === 1) {
      const [sku, soldUnits] = [...soldBySku.entries()][0]!;
      activities.push({
        day,
        order_id: orderId,
        sku,
        category: resolveSkuCategory(sku, categoryBySku),
        units_sold: 0,
        units_returned: Math.min(soldUnits, 1),
        return_usd: refundAmount,
        return_reasons: reason ? [reason] : [],
      });
    }
  }

  return activities;
}

function filterActivitiesForWindow(
  activities: SkuReturnActivity[],
  windowDays: number,
  referenceDay: string,
): SkuReturnActivity[] {
  const ref = new Date(`${referenceDay}T00:00:00.000Z`);
  const start = new Date(ref);
  start.setUTCDate(start.getUTCDate() - (windowDays - 1));

  return activities.filter((activity) => {
    const day = new Date(`${activity.day}T00:00:00.000Z`);
    return day >= start && day <= ref;
  });
}

export function aggregateSkuReturnMetrics(
  activities: SkuReturnActivity[],
  sku: string,
  windowDays: number,
  referenceDay: string,
): SkuReturnMetrics | null {
  const rows = filterActivitiesForWindow(activities, windowDays, referenceDay).filter(
    (activity) => activity.sku === sku,
  );
  if (rows.length === 0) return null;

  let unitsSold = 0;
  let unitsReturned = 0;
  let returnUsd = 0;
  const returnReasonCounts = new Map<string, number>();

  for (const row of rows) {
    unitsSold += row.units_sold;
    unitsReturned += row.units_returned;
    returnUsd += row.return_usd;
    for (const reason of row.return_reasons) {
      returnReasonCounts.set(reason, (returnReasonCounts.get(reason) ?? 0) + 1);
    }
  }

  const category = rows[0]?.category ?? resolveSkuCategory(sku);
  const returnRate = unitsSold > 0 ? unitsReturned / unitsSold : 0;

  return {
    sku,
    category,
    units_sold: unitsSold,
    units_returned: unitsReturned,
    return_usd: returnUsd,
    return_rate: returnRate,
    return_reason_counts: returnReasonCounts,
  };
}

export function computeCategoryReturnBenchmarks(
  activities: SkuReturnActivity[],
  windowDays: number,
  referenceDay: string,
): Map<string, CategoryReturnBenchmark> {
  const windowActivities = filterActivitiesForWindow(activities, windowDays, referenceDay);
  const skus = [...new Set(windowActivities.map((activity) => activity.sku))];
  const metricsBySku = skus
    .map((sku) => aggregateSkuReturnMetrics(windowActivities, sku, windowDays, referenceDay))
    .filter((metrics): metrics is SkuReturnMetrics => metrics != null && metrics.units_sold > 0);

  const byCategory = new Map<string, SkuReturnMetrics[]>();
  for (const metrics of metricsBySku) {
    const rows = byCategory.get(metrics.category) ?? [];
    rows.push(metrics);
    byCategory.set(metrics.category, rows);
  }

  const benchmarks = new Map<string, CategoryReturnBenchmark>();
  for (const [category, rows] of byCategory) {
    const { mean, stddev } = computeMeanAndStdDev(rows.map((row) => row.return_rate));
    benchmarks.set(category, {
      category,
      mean_return_rate: mean,
      stddev_return_rate: stddev,
      sku_count: rows.length,
    });
  }

  return benchmarks;
}

export function qualifiesForReturnDrainLeak(
  metrics: SkuReturnMetrics,
  benchmark: CategoryReturnBenchmark | undefined,
): boolean {
  if (metrics.units_returned < RETURN_DRAIN_THRESHOLDS.min_returns) return false;
  if (metrics.units_sold <= 0) return false;
  if (!benchmark || benchmark.sku_count < 2) return false;

  const threshold =
    benchmark.mean_return_rate +
    RETURN_DRAIN_THRESHOLDS.sigma_multiplier * benchmark.stddev_return_rate;
  return metrics.return_rate > threshold;
}

export function topReturnReasons(
  reasonCounts: Map<string, number>,
  limit = RETURN_DRAIN_THRESHOLDS.top_return_reasons_limit,
): string[] {
  return [...reasonCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([reason]) => reason);
}

export function buildReturnDrainEvidence(
  metrics: SkuReturnMetrics,
  benchmark: CategoryReturnBenchmark,
): ReturnDrainEvidence {
  return {
    sku: metrics.sku,
    category: metrics.category,
    return_rate_pct: metrics.return_rate * 100,
    category_mean_return_rate_pct: benchmark.mean_return_rate * 100,
    category_return_rate_stddev_pct: benchmark.stddev_return_rate * 100,
    returns_usd: metrics.return_usd,
    returns_count: metrics.units_returned,
    top_return_reasons: topReturnReasons(metrics.return_reason_counts),
  };
}

export function evaluateReturnDrainLeak(
  activities: SkuReturnActivity[],
  sku: string,
  referenceDay: string,
): ReturnDrainEvaluation {
  const metrics = aggregateSkuReturnMetrics(
    activities,
    sku,
    RETURN_DRAIN_THRESHOLDS.window_days,
    referenceDay,
  );

  if (!metrics) {
    return {
      sku,
      qualifies: false,
      should_resolve: true,
      amount_at_risk_usd: 0,
      evidence: null,
    };
  }

  const benchmarks = computeCategoryReturnBenchmarks(
    activities,
    RETURN_DRAIN_THRESHOLDS.window_days,
    referenceDay,
  );
  const benchmark = benchmarks.get(metrics.category);
  const qualifies = qualifiesForReturnDrainLeak(metrics, benchmark);

  return {
    sku,
    qualifies,
    should_resolve: !qualifies,
    amount_at_risk_usd: qualifies ? metrics.return_usd : 0,
    evidence:
      qualifies && benchmark ? buildReturnDrainEvidence(metrics, benchmark) : null,
  };
}

export function evaluateReturnDrainLeaks(
  activities: SkuReturnActivity[],
  referenceDay: string,
): ReturnDrainEvaluation[] {
  const skus = [...new Set(activities.map((activity) => activity.sku))];
  return skus.map((sku) => evaluateReturnDrainLeak(activities, sku, referenceDay));
}
